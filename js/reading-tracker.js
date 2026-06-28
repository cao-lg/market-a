(function() {
  'use strict';

  const ACTIVE_TIMEOUT = 30000;
  const SCROLL_THROTTLE = 100;
  const CONTENT_SELECTOR = '#content-area';
  const PARA_SELECTORS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'];

  let sessionData = null;
  let isSessionActive = false;
  let visibilityHandler = null;
  let activityHandler = null;
  let scrollHandler = null;
  let copyHandler = null;
  let keydownHandler = null;
  let beforeunloadHandler = null;
  let intersectionObserver = null;
  let activityTimer = null;
  let isUserActive = false;
  let lastTotalTick = 0;
  let lastActiveTick = 0;
  let hitScrollMilestones = {};

  function generateSessionId() {
    return 'read_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getContentElement() {
    return document.querySelector(CONTENT_SELECTOR);
  }

  function getTotalWordCount() {
    const contentEl = getContentElement();
    if (!contentEl) return 0;
    const text = contentEl.textContent || '';
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  function calculateScrollDepth() {
    const contentEl = getContentElement();
    const scrollContainer = contentEl?.closest('.learn-content') || window;
    let scrollTop, clientHeight, scrollHeight;

    if (scrollContainer === window) {
      scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      clientHeight = window.innerHeight;
      scrollHeight = document.documentElement.scrollHeight;
    } else {
      scrollTop = scrollContainer.scrollTop;
      clientHeight = scrollContainer.clientHeight;
      scrollHeight = scrollContainer.scrollHeight;
    }

    if (scrollHeight <= clientHeight) return 100;
    const depth = ((scrollTop + clientHeight) / scrollHeight) * 100;
    return Math.min(100, Math.max(0, depth));
  }

  function throttle(func, wait) {
    let timeout = null;
    let lastExec = 0;
    return function(...args) {
      const now = Date.now();
      const remaining = wait - (now - lastExec);
      if (remaining <= 0) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        lastExec = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastExec = Date.now();
          timeout = null;
          func.apply(this, args);
        }, remaining);
      }
    };
  }

  function onVisibilityChange() {
    if (!isSessionActive || !sessionData) return;

    if (document.hidden) {
      pauseTimers();
      saveSessionIdle();
    } else {
      resumeTimers();
    }
  }

  function pauseTimers() {
    if (activityTimer) {
      clearInterval(activityTimer);
      activityTimer = null;
    }
    isUserActive = false;
  }

  function resumeTimers() {
    if (!isSessionActive || !sessionData) return;
    lastTotalTick = Date.now();
    lastActiveTick = Date.now();
    startActivityTimer();
  }

  function startActivityTimer() {
    if (activityTimer) clearInterval(activityTimer);
    activityTimer = setInterval(() => {
      if (!isSessionActive || !sessionData) return;
      const now = Date.now();
      const totalDelta = now - lastTotalTick;
      sessionData.totalDuration += totalDelta;
      lastTotalTick = now;
      if (isUserActive) {
        const activeDelta = now - lastActiveTick;
        sessionData.activeDuration += activeDelta;
        lastActiveTick = now;
      }
    }, 1000);
  }

  function onUserActivity() {
    if (!isSessionActive || !sessionData) return;
    if (!isUserActive) {
      isUserActive = true;
      lastActiveTick = Date.now();
    }
    resetActivityTimeout();
  }

  let activityTimeoutTimer = null;
  function resetActivityTimeout() {
    if (activityTimeoutTimer) clearTimeout(activityTimeoutTimer);
    activityTimeoutTimer = setTimeout(() => {
      isUserActive = false;
    }, ACTIVE_TIMEOUT);
  }

  function onScroll() {
    if (!isSessionActive || !sessionData) return;
    sessionData.scrollEvents++;
    const depth = calculateScrollDepth();
    if (depth > sessionData.maxScrollDepth) {
      sessionData.maxScrollDepth = depth;
    }
    checkScrollMilestones(depth);
  }

  function checkScrollMilestones(depth) {
    const milestones = [25, 50, 75, 90, 100];
    for (const milestone of milestones) {
      if (depth >= milestone && !hitScrollMilestones[milestone]) {
        hitScrollMilestones[milestone] = true;
        logEvent('scroll_depth', {
          depth: milestone,
          stageId: sessionData.stageId,
          lessonId: sessionData.lessonId
        });
      }
    }
  }

  const throttledScroll = throttle(onScroll, SCROLL_THROTTLE);

  function onCopy() {
    if (!isSessionActive || !sessionData) return;
    sessionData.copyCount++;
    logEvent('content_copy', {
      stageId: sessionData.stageId,
      lessonId: sessionData.lessonId
    });
  }

  function onKeydown(e) {
    if (!isSessionActive || !sessionData) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      sessionData.searchCount++;
      logEvent('search', {
        stageId: sessionData.stageId,
        lessonId: sessionData.lessonId,
        trigger: 'ctrl_f'
      });
    } else if (e.key === 'F3') {
      sessionData.searchCount++;
      logEvent('search', {
        stageId: sessionData.stageId,
        lessonId: sessionData.lessonId,
        trigger: 'f3'
      });
    }
  }

  function logEvent(eventName, data = {}) {
    if (!window.DB || !window.DB.eventLogs) return;
    try {
      const eventData = {
        eventType: 'reading',
        eventName,
        timestamp: Date.now(),
        sessionId: sessionData?.sessionId,
        stageId: data.stageId,
        lessonId: data.lessonId,
        page: 'learn',
        ...data
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          DB.eventLogs.add(eventData).catch(() => {});
        });
      } else {
        setTimeout(() => {
          DB.eventLogs.add(eventData).catch(() => {});
        }, 0);
      }
    } catch (e) {
      console.warn('Failed to log event:', e);
    }
  }

  function initParagraphObserver() {
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    const contentEl = getContentElement();
    if (!contentEl) return;
    if (!('IntersectionObserver' in window)) return;

    const paras = contentEl.querySelectorAll(PARA_SELECTORS.join(','));
    if (paras.length === 0) return;

    sessionData.paragraphs = sessionData.paragraphs || [];
    const paraMap = new Map();

    paras.forEach((el, index) => {
      el.dataset.paraIndex = index;
      sessionData.paragraphs[index] = sessionData.paragraphs[index] || {
        paraIndex: index,
        tagName: el.tagName.toLowerCase(),
        duration: 0,
        visits: 0,
        enterTime: null
      };
      paraMap.set(index, sessionData.paragraphs[index]);
    });

    intersectionObserver = new IntersectionObserver((entries) => {
      if (!isSessionActive || !sessionData) return;
      entries.forEach((entry) => {
        const index = parseInt(entry.target.dataset.paraIndex, 10);
        const para = paraMap.get(index);
        if (!para) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          if (para.enterTime === null) {
            para.enterTime = Date.now();
            para.visits++;
          }
        } else {
          if (para.enterTime !== null) {
            para.duration += Date.now() - para.enterTime;
            para.enterTime = null;
          }
        }
      });
    }, {
      root: contentEl.closest('.learn-content') || null,
      threshold: [0, 0.3, 0.6, 1.0]
    });

    paras.forEach(el => intersectionObserver.observe(el));
  }

  function flushParagraphTimes() {
    if (!sessionData || !sessionData.paragraphs) return;
    sessionData.paragraphs.forEach(para => {
      if (para.enterTime !== null) {
        para.duration += Date.now() - para.enterTime;
        para.enterTime = null;
      }
    });
  }

  async function calculateRevisitCount(stageId, lessonId) {
    if (!window.DB || !window.DB.readingBehavior) return 0;
    try {
      const records = await DB.readingBehavior.getByLesson(null, lessonId);
      return records.length;
    } catch (e) {
      return 0;
    }
  }

  function calculateReadingSpeed() {
    if (!sessionData) return 0;
    const activeSeconds = sessionData.activeDuration / 1000;
    if (activeSeconds < 30) return 0;
    const totalWords = sessionData.totalWordCount;
    const readWords = Math.round(totalWords * (sessionData.maxScrollDepth / 100));
    const minutes = activeSeconds / 60;
    return Math.round(readWords / minutes);
  }

  async function startSession(stageId, lessonId) {
    if (isSessionActive) {
      await endSession();
    }

    const revisitCount = await calculateRevisitCount(stageId, lessonId);

    sessionData = {
      sessionId: generateSessionId(),
      stageId,
      lessonId,
      startTime: Date.now(),
      endTime: null,
      totalDuration: 0,
      activeDuration: 0,
      maxScrollDepth: 0,
      scrollEvents: 0,
      copyCount: 0,
      searchCount: 0,
      revisitCount: revisitCount + 1,
      totalWordCount: 0,
      avgReadingSpeed: 0,
      paragraphs: [],
      completed: false
    };

    isSessionActive = true;
    hitScrollMilestones = {};
    isUserActive = true;
    lastTotalTick = Date.now();
    lastActiveTick = Date.now();

    sessionData.totalWordCount = getTotalWordCount();

    attachEventListeners();
    startActivityTimer();
    resetActivityTimeout();
    initParagraphObserver();

    logEvent('page_view', {
      stageId,
      lessonId,
      revisitCount: sessionData.revisitCount
    });

    return sessionData.sessionId;
  }

  async function endSession() {
    if (!isSessionActive || !sessionData) return null;

    pauseTimers();
    flushParagraphTimes();
    detachEventListeners();

    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }

    sessionData.endTime = Date.now();
    sessionData.avgReadingSpeed = calculateReadingSpeed();

    const totalSeconds = sessionData.totalDuration / 1000;
    if (sessionData.maxScrollDepth >= 90 && totalSeconds >= 60) {
      sessionData.completed = true;
      logEvent('lesson_complete', {
        stageId: sessionData.stageId,
        lessonId: sessionData.lessonId,
        scrollDepth: sessionData.maxScrollDepth,
        duration: sessionData.totalDuration
      });
    }

    const saveData = {
      sessionId: sessionData.sessionId,
      stageId: sessionData.stageId,
      lessonId: sessionData.lessonId,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      totalDuration: sessionData.totalDuration,
      activeDuration: sessionData.activeDuration,
      maxScrollDepth: Math.round(sessionData.maxScrollDepth * 100) / 100,
      scrollEvents: sessionData.scrollEvents,
      copyCount: sessionData.copyCount,
      searchCount: sessionData.searchCount,
      revisitCount: sessionData.revisitCount,
      totalWordCount: sessionData.totalWordCount,
      avgReadingSpeed: sessionData.avgReadingSpeed,
      paragraphs: sessionData.paragraphs,
      completed: sessionData.completed,
      createdAt: sessionData.startTime
    };

    if (window.DB && window.DB.readingBehavior) {
      try {
        await DB.readingBehavior.add(saveData);
      } catch (e) {
        console.warn('Failed to save reading behavior:', e);
      }
    }

    const endedSession = { ...sessionData };
    sessionData = null;
    isSessionActive = false;

    return endedSession;
  }

  function saveSessionIdle() {
    if (!isSessionActive || !sessionData) return;
    flushParagraphTimes();
  }

  function attachEventListeners() {
    visibilityHandler = onVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);

    activityHandler = onUserActivity;
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(evt => {
      document.addEventListener(evt, activityHandler, { passive: true });
    });

    scrollHandler = throttledScroll;
    const scrollContainer = getContentElement()?.closest('.learn-content');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
    } else {
      window.addEventListener('scroll', scrollHandler, { passive: true });
    }

    copyHandler = onCopy;
    document.addEventListener('copy', copyHandler);

    keydownHandler = onKeydown;
    document.addEventListener('keydown', keydownHandler);

    beforeunloadHandler = (e) => {
      if (isSessionActive && sessionData) {
        pauseTimers();
        flushParagraphTimes();
        sessionData.endTime = Date.now();
        sessionData.avgReadingSpeed = calculateReadingSpeed();
        const saveData = {
          sessionId: sessionData.sessionId,
          stageId: sessionData.stageId,
          lessonId: sessionData.lessonId,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          totalDuration: sessionData.totalDuration,
          activeDuration: sessionData.activeDuration,
          maxScrollDepth: Math.round(sessionData.maxScrollDepth * 100) / 100,
          scrollEvents: sessionData.scrollEvents,
          copyCount: sessionData.copyCount,
          searchCount: sessionData.searchCount,
          revisitCount: sessionData.revisitCount,
          totalWordCount: sessionData.totalWordCount,
          avgReadingSpeed: sessionData.avgReadingSpeed,
          paragraphs: sessionData.paragraphs,
          completed: sessionData.completed,
          createdAt: sessionData.startTime
        };
        if (window.DB && window.DB.readingBehavior && window.indexedDB) {
          try {
            const request = indexedDB.open('MarketDataAnalysisDB', 3);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('reading_behavior', 'readwrite');
              tx.objectStore('reading_behavior').add({
                ...saveData,
                studentId: localStorage.getItem('current_student_id') || localStorage.getItem('default_student_id')
              });
            };
          } catch (e) {}
        }
      }
    };
    window.addEventListener('beforeunload', beforeunloadHandler);
  }

  function detachEventListeners() {
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }

    if (activityHandler) {
      const activityEvents = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
      activityEvents.forEach(evt => {
        document.removeEventListener(evt, activityHandler);
      });
      activityHandler = null;
    }

    if (scrollHandler) {
      const scrollContainer = getContentElement()?.closest('.learn-content');
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', scrollHandler);
      } else {
        window.removeEventListener('scroll', scrollHandler);
      }
      scrollHandler = null;
    }

    if (copyHandler) {
      document.removeEventListener('copy', copyHandler);
      copyHandler = null;
    }

    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }

    if (beforeunloadHandler) {
      window.removeEventListener('beforeunload', beforeunloadHandler);
      beforeunloadHandler = null;
    }

    if (activityTimeoutTimer) {
      clearTimeout(activityTimeoutTimer);
      activityTimeoutTimer = null;
    }
  }

  function reinitParagraphObserver() {
    if (!isSessionActive || !sessionData) return;
    sessionData.totalWordCount = getTotalWordCount();
    initParagraphObserver();
  }

  function getCurrentSession() {
    return sessionData ? { ...sessionData } : null;
  }

  function getReadingStats() {
    if (!sessionData) return null;
    return {
      totalDuration: sessionData.totalDuration,
      activeDuration: sessionData.activeDuration,
      maxScrollDepth: sessionData.maxScrollDepth,
      scrollEvents: sessionData.scrollEvents,
      copyCount: sessionData.copyCount,
      searchCount: sessionData.searchCount,
      avgReadingSpeed: calculateReadingSpeed(),
      revisitCount: sessionData.revisitCount,
      totalWordCount: sessionData.totalWordCount
    };
  }

  window.ReadingTracker = {
    startSession,
    endSession,
    getCurrentSession,
    getReadingStats,
    reinitParagraphObserver,
    isActive: () => isSessionActive
  };

})();
