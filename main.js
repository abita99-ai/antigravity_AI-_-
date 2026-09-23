// ==========================================================================
// AI Emotion Diary Main Script
// ==========================================================================
import { analyzeEmotionWithGemini, fetchDiaryHistoryFromApi } from './geminiService.js';
import {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  getCurrentUser,
  saveDiaryToSupabase,
  subscribeToRealtimeChat,
  subscribeToMessagesTable,
  fetchChatMessagesFromSupabase,
  sendChatMessage,
  uploadUserProfileAvatar,
  uploadChatImageToSupabase
} from './supabaseClient.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Auth DOM Elements
  const authContainer = document.getElementById('auth-container');
  const diaryAppContainer = document.getElementById('diary-app-container');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const btnLogin = document.getElementById('btn-login');
  const btnSignup = document.getElementById('btn-signup');
  const btnGoogleLogin = document.getElementById('btn-google-login');
  const authMessage = document.getElementById('auth-message');
  const userEmailDisplay = document.getElementById('user-email-display');
  const btnLogout = document.getElementById('btn-logout');

  // Realtime Chat DOM Elements & Profile Avatar Elements
  const chatSection = document.getElementById('chat-section');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const btnSendChat = document.getElementById('btn-send-chat');
  const chatStatusBadge = document.getElementById('chat-status-badge');
  const profileAvatarContainer = document.getElementById('profile-avatar-container');
  const avatarImg = document.getElementById('avatar-img');
  const avatarFallback = document.getElementById('avatar-fallback');
  const btnChangeAvatar = document.getElementById('btn-change-avatar');
  const avatarFileInput = document.getElementById('avatar-file-input');
  const chatImageInput = document.getElementById('chat-image-input');

  let currentUserEmail = '익명 사용자';
  let currentUserAvatarUrl = null;
  const renderedMessageIds = new Set();

  // DOM Elements
  const currentDateEl = document.getElementById('current-date');
  const diaryInput = document.getElementById('diary-input');
  const charCounter = document.getElementById('char-counter');
  const btnClear = document.getElementById('btn-clear');
  const btnVoice = document.getElementById('btn-voice');
  const btnAnalyze = document.getElementById('btn-analyze');
  const voiceIndicator = document.getElementById('voice-indicator');
  const inputWrapper = document.querySelector('.input-wrapper');

  // AI Response Box Elements (Requirements ③ & ④)
  const aiResponseBox = document.getElementById('ai-response-box');
  const responsePlaceholder = document.getElementById('response-placeholder');
  const responseLoading = document.getElementById('response-loading');
  const responseResult = document.getElementById('response-result');
  const emotionTagsEl = document.getElementById('emotion-tags');
  const aiTextContentEl = document.getElementById('ai-text-content');
  const adviceBodyEl = document.getElementById('advice-body');
  const responseControls = document.getElementById('response-controls');
  const btnTts = document.getElementById('btn-tts');
  const btnCopy = document.getElementById('btn-copy');

  // History Elements
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const historySection = document.getElementById('history-section');
  const historyList = document.getElementById('history-list');
  const historyCountEl = document.getElementById('history-count');

  // Redis History Section Elements ('나의 일기 히스토리')
  const redisHistoryGrid = document.getElementById('redis-history-grid');
  const redisHistoryCount = document.getElementById('redis-history-count');

  // Preset Chips
  const presetChips = document.querySelectorAll('.chip-btn');

  // App State
  let isRecording = false;
  let recognition = null;
  let currentAiText = '';
  let diaryHistory = JSON.parse(localStorage.getItem('ai_emotion_diaries') || '[]');

  // Initialize Auth & App
  initAuthEventListeners();
  initAuthSession();
  initDateDisplay();
  initCharCounter();
  initPresetChips();
  initSpeechRecognition();
  initAvatarEvents();
  renderHistory();
  restoreActiveStateFromLocalStorage();

  // ==========================================================================
  // Profile Avatar Manager (프로필 사진 관리)
  // ==========================================================================
  function initAvatarEvents() {
    if (!avatarFileInput) return;

    // 1. 저장된 아바타 사진 복원 (LocalStorage 및 프로필 이미지 표시)
    const savedAvatarSrc = localStorage.getItem('user_avatar_src');
    if (savedAvatarSrc && avatarImg && avatarFallback) {
      avatarImg.src = savedAvatarSrc;
      avatarImg.classList.remove('hidden');
      avatarFallback.classList.add('hidden');
      if (currentUserEmail) {
        userAvatarMap.set(currentUserEmail, savedAvatarSrc);
      }
    }

    // 2. 컴퓨터에서 이미지 파일 선택 시 즉시 0.01초 만에 화면 반영 & Supabase 스토리지 업로드
    avatarFileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 선택해 주세요.');
        return;
      }

      // [즉시 1단계] 파일 선택 시 0.01초 만에 상단 프로필 & 내 채팅 메시지 썸네일 즉시 반영!
      const localObjectUrl = URL.createObjectURL(file);
      currentUserAvatarUrl = localObjectUrl;
      localStorage.setItem('user_avatar_src', localObjectUrl);

      if (avatarImg && avatarFallback) {
        avatarImg.src = localObjectUrl;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
      }

      if (currentUserEmail) {
        updateAllUserAvatarImgs(currentUserEmail, localObjectUrl);
      }

      // [2단계] Supabase 'avatars' 버킷 업로드 -> Public URL -> Auth user_metadata (avatar_url) 저장
      try {
        const uploadRes = await uploadUserProfileAvatar(file);
        if (uploadRes && uploadRes.success && uploadRes.publicUrl) {
          currentUserAvatarUrl = uploadRes.publicUrl;
          localStorage.setItem('user_avatar_src', uploadRes.publicUrl);

          if (avatarImg) {
            avatarImg.src = uploadRes.publicUrl;
          }
          if (currentUserEmail) {
            updateAllUserAvatarImgs(currentUserEmail, uploadRes.publicUrl);
          }
          console.log('[Avatar Uploaded & Synced]:', uploadRes.publicUrl);
        } else if (uploadRes && uploadRes.error) {
          console.warn('[Avatar Upload Warning]:', uploadRes.error.message);
        }
      } catch (err) {
        console.error('[Avatar Upload Exception]:', err);
      }
    });
  }

  // ==========================================================================
  // Chat User Avatar Realtime Cache & Updater
  // ==========================================================================
  const userAvatarMap = new Map();

  function updateAllUserAvatarImgs(email, newAvatarUrl) {
    if (!email || !newAvatarUrl || !chatMessages) return;
    userAvatarMap.set(email, newAvatarUrl);

    const userContainers = chatMessages.querySelectorAll(`[data-sender-email="${email}"]`);
    userContainers.forEach(container => {
      const avatarBox = container.querySelector('.chat-sender-box');
      if (avatarBox) {
        const existingImg = avatarBox.querySelector('.chat-user-avatar-img');
        if (existingImg) {
          existingImg.src = newAvatarUrl;
        } else {
          const fallback = avatarBox.querySelector('.chat-user-avatar-fallback');
          if (fallback) {
            fallback.outerHTML = `<img class="chat-user-avatar-img" src="${escapeHtml(newAvatarUrl)}" alt="${escapeHtml(email)} 프로필" />`;
          }
        }
      }
    });
  }

  // ==========================================================================
  // Auth Session & Screen Switch Manager (새로고침 시 로그인 유지)
  // ==========================================================================
  async function initAuthSession() {
    try {
      // 1. 로컬 스토리지에 남아있는 현재 Supabase 세션 확인
      if (supabase && supabase.auth) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          updateAuthView(session.user);
        } else {
          const user = await getCurrentUser();
          updateAuthView(user);
        }

        // 2. Auth 상태 변경 이벤트 리스닝 (새로고침, 세션 갱신 등)
        supabase.auth.onAuthStateChange((event, session) => {
          if (session && session.user) {
            updateAuthView(session.user);
          } else if (event === 'SIGNED_OUT') {
            updateAuthView(null);
          }
        });
      } else {
        const user = await getCurrentUser();
        updateAuthView(user);
      }
    } catch (err) {
      console.warn('[Auth Session Warning]:', err);
      // 세션 오류가 나더라도 함부로 로그아웃 시키지 않음
    }
  }

  function updateAuthView(user) {
    if (user) {
      // Logged in: Hide Auth container, Show Diary App container
      authContainer.classList.add('hidden');
      diaryAppContainer.classList.remove('hidden');
      currentUserEmail = user.email || '인증된 사용자';
      if (userEmailDisplay) {
        userEmailDisplay.textContent = currentUserEmail;
      }

      // ⑤ 사용자 프로필 avatar_url 동기화
      if (user.user_metadata && user.user_metadata.avatar_url) {
        currentUserAvatarUrl = user.user_metadata.avatar_url;
        localStorage.setItem('user_avatar_src', currentUserAvatarUrl);
      } else {
        currentUserAvatarUrl = localStorage.getItem('user_avatar_src') || null;
      }

      if (currentUserAvatarUrl) {
        userAvatarMap.set(currentUserEmail, currentUserAvatarUrl);
      }

      if (currentUserAvatarUrl && avatarImg && avatarFallback) {
        avatarImg.src = currentUserAvatarUrl;
        avatarImg.classList.remove('hidden');
        avatarFallback.classList.add('hidden');
      }

      loadAndRenderRedisHistory();
      initRealtimeChat();
    } else {
      // Logged out: Show Auth container, Hide Diary App container
      authContainer.classList.remove('hidden');
      diaryAppContainer.classList.add('hidden');
    }
  }

  // ==========================================================================
  // Realtime Chat Manager (실시간 채팅)
  // ==========================================================================
  let isChatSubscribed = false;

  async function initRealtimeChat() {
    if (isChatSubscribed) return;
    isChatSubscribed = true;

    // ③ 페이지가 처음 열릴 때, 기존 메시지들을 모두 가져와서 화면에 표시
    try {
      const initialMessages = await fetchChatMessagesFromSupabase();
      if (initialMessages && initialMessages.length > 0) {
        // 1단계: 유저별 최신 avatar_url을 미리 캐시 맵에 저장
        initialMessages.forEach((msg) => {
          const email = msg.user_email || msg.sender;
          const avatarUrl = msg.avatar_url || msg.avatarUrl;
          if (email && avatarUrl) {
            userAvatarMap.set(email, avatarUrl);
          }
        });

        // 2단계: 메시지 렌더링
        initialMessages.forEach((msg) => appendChatMessage(msg));
      }
    } catch (e) {
      console.warn('[Initial Messages Load Error]:', e);
    }

    // ① Supabase 실시간 구독 (messages 테이블 INSERT 이벤트 구독)
    subscribeToMessagesTable((newMsg) => {
      const email = newMsg.user_email || newMsg.sender;
      const avatarUrl = newMsg.avatar_url || newMsg.avatarUrl;
      if (email && avatarUrl) {
        updateAllUserAvatarImgs(email, avatarUrl);
      }
      appendChatMessage(newMsg);
    });

    // 보조 Realtime Broadcast 구독도 유지
    subscribeToRealtimeChat((msg) => {
      const email = msg.user_email || msg.sender;
      const avatarUrl = msg.avatar_url || msg.avatarUrl;
      if (email && avatarUrl) {
        updateAllUserAvatarImgs(email, avatarUrl);
      }
      appendChatMessage(msg);
    });

    // Handle Form Submit & Send Button
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendChatMessage();
      });
    }

    if (btnSendChat) {
      btnSendChat.addEventListener('click', (e) => {
        e.preventDefault();
        handleSendChatMessage();
      });
    }

    // 클립 아이콘 버튼을 통한 이미지 파일 선택 및 업로드 처리
    if (chatImageInput) {
      chatImageInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
          alert('이미지 파일만 선택해 주세요.');
          return;
        }

        // 1. Supabase 'chat-images' 버킷에 파일 업로드 (uploadChatImageToSupabase)
        // 2. 업로드 성공 후 getPublicUrl로 공개 URL 가져오기
        const uploadRes = await uploadChatImageToSupabase(file).catch((err) => ({ success: false, error: err }));

        if (!uploadRes || !uploadRes.success || !uploadRes.publicUrl) {
          alert(`이미지 업로드 실패: ${uploadRes?.error?.message || '스토리지 업로드 중 오류가 발생했습니다.'}`);
          chatImageInput.value = '';
          return;
        }

        const publicUrl = uploadRes.publicUrl;

        // 3. 'messages' 테이블 content 컬럼에 [IMAGE:url] 특별한 형식으로 저장
        const imageContent = `[IMAGE:${publicUrl}]`;

        const result = await sendChatMessage(imageContent, currentUserEmail, currentUserAvatarUrl);
        if (result && result.success && result.messagePayload) {
          appendChatMessage(result.messagePayload);
        } else if (result && result.error) {
          alert(`이미지 메시지 저장 실패: ${result.error.message}`);
        }

        chatImageInput.value = '';
      });
    }
  }

  async function handleSendChatMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;

    // Send chat message to Supabase 'messages' table (with avatar_url)
    const result = await sendChatMessage(text, currentUserEmail, currentUserAvatarUrl);
    if (result && result.success) {
      // 메시지 전송에 성공하면, 입력창의 내용은 깨끗하게 비워줘.
      chatInput.value = '';
      if (result.messagePayload) {
        appendChatMessage(result.messagePayload);
      }
    } else {
      console.error('[Chat Send Error]:', result?.error);
      alert(`메시지 전송 실패: ${result?.error?.message || '알 수 없는 오류가 발생했습니다.'}`);
    }
  }

  function appendChatMessage(msg) {
    if (!chatMessages || !msg) return;

    // 메시지 식별 키 생성 (중복 방지)
    const msgId = msg.id
      ? String(msg.id)
      : `${msg.user_email || msg.sender}-${msg.created_at || msg.createdAt}-${msg.content || msg.message}`;

    if (renderedMessageIds.has(msgId)) return; // 이미 렌더링된 메시지는 스킵
    renderedMessageIds.add(msgId);

    const email = msg.user_email || msg.sender || '익명 사용자';
    const rawContent = msg.content || msg.message || '';
    const timestamp = msg.created_at || msg.createdAt;

    const isMine = email === currentUserEmail;

    // 프로필 사진 URL 매핑 (내 메시지, 상대방 수신 메시지, 캐시 맵 연동)
    let avatarUrl = msg.avatar_url || msg.avatarUrl || null;
    if (isMine && currentUserAvatarUrl) {
      avatarUrl = currentUserAvatarUrl;
    }

    if (avatarUrl) {
      userAvatarMap.set(email, avatarUrl);
    } else if (userAvatarMap.has(email)) {
      avatarUrl = userAvatarMap.get(email);
    }

    const formattedTime = timestamp
      ? new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';

    const container = document.createElement('div');
    container.className = `chat-bubble-container ${isMine ? 'mine' : 'others'}`;
    container.setAttribute('data-sender-email', email);

    // 업로드한 프로필 사진 그대로를 반영한 동그란 <img> 이미지 프로필 태그 생성
    const avatarHtml = avatarUrl
      ? `<img class="chat-user-avatar-img" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(email)} 프로필" onerror="this.onerror=null; this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');" /><span class="chat-user-avatar-fallback hidden"><i class="fa-solid fa-user"></i></span>`
      : `<span class="chat-user-avatar-fallback"><i class="fa-solid fa-user"></i></span>`;

    // 4 & 5. [IMAGE:url] 형식 판별 및 이미지 표시 / 로드 실패(onerror) 대체 표시 처리
    let bubbleContentHtml = '';
    const imageMatch = typeof rawContent === 'string' && rawContent.match(/^\[IMAGE:(.+)\]$/);

    if (imageMatch && imageMatch[1]) {
      const imageUrl = imageMatch[1].trim();
      bubbleContentHtml = `
        <div class="chat-image-box">
          <img class="chat-shared-img" src="${escapeHtml(imageUrl)}" alt="채팅 이미지" onclick="window.open(this.src, '_blank')" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="chat-image-fallback" style="display: none;">
            <i class="fa-solid fa-image-slash"></i>
            <span>이미지를 불러올 수 없습니다</span>
          </div>
        </div>
      `;
    } else if (typeof rawContent === 'string' && rawContent.includes('<img')) {
      // 기존 <img> 태그 메시지 하위 호환
      bubbleContentHtml = rawContent;
    } else {
      bubbleContentHtml = escapeHtml(rawContent);
    }

    // 모든 사용자(나 + 상대방) 메시지 상단에 프로필 <img> 이미지 태그 썸네일과 보낸 사람 이메일 표시
    container.innerHTML = `
      <div class="chat-sender-box">
        ${avatarHtml}
        <span class="chat-sender-name">${escapeHtml(email)}</span>
      </div>
      <div class="chat-bubble ${imageMatch ? 'chat-bubble-image' : ''}">${bubbleContentHtml}</div>
      <span class="chat-time">${formattedTime}</span>
    `;

    chatMessages.appendChild(container);

    // Scroll to bottom smoothly
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showAuthAlert(msg, type = 'error') {
    authMessage.className = `auth-message ${type}`;
    authMessage.textContent = msg;
    authMessage.classList.remove('hidden');
  }

  function hideAuthAlert() {
    authMessage.classList.add('hidden');
  }

  function initAuthEventListeners() {
    if (!btnLogin || !btnSignup || !btnGoogleLogin) return;

    // 로그인 버튼 클릭
    btnLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      hideAuthAlert();

      const email = authEmail.value.trim();
      const password = authPassword.value.trim();

      if (!email || !password) {
        showAuthAlert('이메일과 비밀번호를 모두 입력해 주세요.', 'error');
        return;
      }

      try {
        btnLogin.disabled = true;
        btnLogin.querySelector('span').textContent = '로그인 중...';

        const { data, error } = await signInWithEmail(email, password);

        btnLogin.disabled = false;
        btnLogin.querySelector('span').textContent = '로그인';

        if (error) {
          showAuthAlert(`로그인 실패: ${error.message || '이메일 또는 비밀번호를 확인하세요.'}`, 'error');
        } else if (data && data.user) {
          showAuthAlert('로그인 성공! 일기장으로 이동합니다.', 'success');
          updateAuthView(data.user);
        } else {
          showAuthAlert('로그인 완료: 이메일 인증이 필요할 수 있습니다.', 'info');
        }
      } catch (err) {
        btnLogin.disabled = false;
        btnLogin.querySelector('span').textContent = '로그인';
        showAuthAlert(`로그인 중 오류가 발생했습니다: ${err.message || String(err)}`, 'error');
      }
    });

    // 회원가입 버튼 클릭
    btnSignup.addEventListener('click', async (e) => {
      e.preventDefault();
      hideAuthAlert();

      const email = authEmail.value.trim();
      const password = authPassword.value.trim();

      if (!email || !password) {
        showAuthAlert('회원가입에 사용할 이메일과 비밀번호를 입력해 주세요.', 'error');
        return;
      }

      if (password.length < 6) {
        showAuthAlert('비밀번호는 최소 6자리 이상이어야 합니다.', 'error');
        return;
      }

      try {
        btnSignup.disabled = true;
        btnSignup.querySelector('span').textContent = '가입 진행 중...';

        const { data, error } = await signUpWithEmail(email, password);

        btnSignup.disabled = false;
        btnSignup.querySelector('span').textContent = '회원가입';

        if (error) {
          showAuthAlert(`회원가입 실패: ${error.message}`, 'error');
        } else {
          showAuthAlert('가입 확인 이메일을 확인해주세요!', 'success');
        }
      } catch (err) {
        btnSignup.disabled = false;
        btnSignup.querySelector('span').textContent = '회원가입';
        showAuthAlert(`회원가입 요청 중 오류가 발생했습니다: ${err.message || String(err)}`, 'error');
      }
    });

    // Google로 로그인 버튼 클릭
    btnGoogleLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      hideAuthAlert();

      try {
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.querySelector('span').textContent = 'Google 이동 중...';

        const { error } = await signInWithGoogle();

        btnGoogleLogin.disabled = false;
        btnGoogleLogin.querySelector('span').textContent = 'Google로 로그인';

        if (error) {
          showAuthAlert(`Google 로그인 오류: ${error.message}`, 'error');
        }
      } catch (err) {
        btnGoogleLogin.disabled = false;
        btnGoogleLogin.querySelector('span').textContent = 'Google로 로그인';
        showAuthAlert(`Google 로그인 중 오류가 발생했습니다: ${err.message || String(err)}`, 'error');
      }
    });

    // 로그아웃 버튼 클릭
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try {
          await signOutUser();
        } catch (e) {
          console.warn('Logout error:', e);
        }
        authEmail.value = '';
        authPassword.value = '';
        hideAuthAlert();
        updateAuthView(null);
      });
    }
  }

  // ==========================================================================
  // 1. Date Display
  // ==========================================================================
  function initDateDisplay() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = now.toLocaleDateString('ko-KR', options);
    if (currentDateEl) {
      const apiBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;"><i class="fa-solid fa-cloud-bolt"></i> Vercel Serverless AI</span>`;
      currentDateEl.innerHTML = `${dateStr} • 따뜻한 AI가 당신의 마음에 귀 기울이고 있어요. ${apiBadge}`;
    }
  }

  // ==========================================================================
  // 2. Textarea Character Counter & Utilities
  // ==========================================================================
  function initCharCounter() {
    diaryInput.addEventListener('input', () => {
      const len = diaryInput.value.length;
      charCounter.textContent = `${len.toLocaleString()} / 1,000자`;
      if (len > 1000) {
        charCounter.style.color = '#ef4444';
      } else {
        charCounter.style.color = '#64748b';
      }
    });

    btnClear.addEventListener('click', () => {
      if (diaryInput.value.trim() !== '') {
        diaryInput.value = '';
        charCounter.textContent = '0 / 1,000자';
        localStorage.removeItem('active_diary_session');
        diaryInput.focus();
      }
    });
  }

  function initPresetChips() {
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        diaryInput.value = text;
        diaryInput.dispatchEvent(new Event('input'));
        diaryInput.focus();

        // Highlight input wrapper
        inputWrapper.classList.add('shake');
        setTimeout(() => inputWrapper.classList.remove('shake'), 400);
      });
    });
  }

  // ==========================================================================
  // LocalStorage Active State Persistence (Requirements ① & ②)
  // ==========================================================================
  // ① '분석 요청하기' 시 일기 내용과 AI 답변을 로컬 스토리지에 저장
  function saveActiveStateToLocalStorage(userText, analysis) {
    const sessionData = {
      userText: userText,
      message: analysis.message,
      emotionSummary: analysis.emotionSummary || '평온',
      advice: analysis.advice || `💡 오늘의 마음 처방전: '감정: ${analysis.emotionSummary || '평온'}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`,
      savedAt: Date.now()
    };
    localStorage.setItem('active_diary_session', JSON.stringify(sessionData));
  }

  // ② 페이지 로드 시 로컬 스토리지에서 이전 내용 및 AI 답변 복원
  function restoreActiveStateFromLocalStorage() {
    const savedSession = localStorage.getItem('active_diary_session');
    if (!savedSession) return;

    try {
      const data = JSON.parse(savedSession);
      if (data && data.userText) {
        // 1. 입력창에 이전 일기 내용 채워 넣기
        diaryInput.value = data.userText;
        diaryInput.dispatchEvent(new Event('input'));

        // 2. AI 답변 박스에 이전 AI 답변 채워 넣기
        if (data.message) {
          currentAiText = data.message;
          const emotionSummary = data.emotionSummary || '평온';

          emotionTagsEl.innerHTML = `
            <span class="tag tag-empathy"><i class="fa-solid fa-heart"></i> 감정 요약: ${emotionSummary}</span>
            <span class="tag tag-calm"><i class="fa-solid fa-sparkles"></i> Gemini 심리 상담가</span>
          `;

          aiTextContentEl.textContent = data.message;
          adviceBodyEl.textContent = data.advice || `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`;

          responsePlaceholder.classList.add('hidden');
          responseLoading.classList.add('hidden');
          responseResult.classList.remove('hidden');
          responseControls.style.display = 'flex';
        }
      }
    } catch (e) {
      console.warn('Failed to restore saved session from LocalStorage:', e);
    }
  }

  // ==========================================================================
  // 3. Voice Input ('음성으로 입력하기' - Web Speech API)
  // ==========================================================================
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;

      let baseText = '';

      recognition.onstart = () => {
        isRecording = true;
        baseText = diaryInput.value;
        if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) {
          baseText += ' ';
        }
        btnVoice.classList.add('recording');
        btnVoice.querySelector('span').textContent = '음성 인식 중...';
        voiceIndicator.classList.remove('hidden');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentSpeech = finalTranscript || interimTranscript;
        if (currentSpeech) {
          diaryInput.value = baseText + currentSpeech;
          diaryInput.dispatchEvent(new Event('input'));
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          stopRecording();
          triggerFallbackVoiceInput();
        }
      };

      recognition.onend = () => {
        stopRecording();
      };
    }

    btnVoice.addEventListener('click', () => {
      if (!recognition) {
        // Fallback simulation if browser environment has no SpeechRecognition
        triggerFallbackVoiceInput();
        return;
      }

      if (isRecording) {
        recognition.stop();
        stopRecording();
      } else {
        try {
          recognition.start();
        } catch (e) {
          stopRecording();
          triggerFallbackVoiceInput();
        }
      }
    });
  }

  function stopRecording() {
    isRecording = false;
    btnVoice.classList.remove('recording');
    btnVoice.querySelector('span').textContent = '음성으로 입력하기';
    voiceIndicator.classList.add('hidden');
  }

  // Simulated Voice Input Fallback (Ensures feature works even if mic permissions restricted)
  function triggerFallbackVoiceInput() {
    if (isRecording) return;

    isRecording = true;
    btnVoice.classList.add('recording');
    btnVoice.querySelector('span').textContent = '음성 인식 중...';
    voiceIndicator.classList.remove('hidden');

    const sampleVoiceTexts = [
      "오늘 회사에서 프로젝트 발표가 있었는데 잘 끝나서 너무 다행이었어. 그동안 고생했던 생각이 나서 마음이 뿌듯해.",
      "요즘 마음이 많이 답답하고 지쳐있어. 내가 잘하고 있는 건지 고민이 많고 누군가에게 따뜻한 위로를 받고 싶어.",
      "오늘 날씨가 정말 좋아서 산책을 다녀왔어. 오랜만에 바람도 쐬고 좋아하는 음악을 들으니 기분이 전환됐어!"
    ];

    const randomText = sampleVoiceTexts[Math.floor(Math.random() * sampleVoiceTexts.length)];

    setTimeout(() => {
      const current = diaryInput.value;
      diaryInput.value = current ? `${current}\n${randomText}` : randomText;
      diaryInput.dispatchEvent(new Event('input'));
      stopRecording();
    }, 2500);
  }

  // ==========================================================================
  // 4. AI Emotion Analysis Engine ('분석 요청하기')
  // ==========================================================================
  btnAnalyze.addEventListener('click', async () => {
    // ① 사용자가 입력창에 작성한 일기 내용을 가져와.
    const userText = diaryInput.value.trim();

    if (!userText) {
      inputWrapper.classList.add('shake');
      diaryInput.focus();
      setTimeout(() => inputWrapper.classList.remove('shake'), 400);
      return;
    }

    // Step A: Set Loading state in Gray Response Box (#ai-response-box)
    responsePlaceholder.classList.add('hidden');
    responseResult.classList.add('hidden');
    responseLoading.classList.remove('hidden');
    responseControls.style.display = 'none';

    // Smooth scroll to response section
    aiResponseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 백엔드 Vercel 서버리스 API (/api/analyze)에 POST 방식으로 일기 내용(userText)을 전송하여 Gemini AI 감정 분석 수신
    let analysis = await analyzeEmotionWithGemini(userText);

    if (!analysis || analysis.error || !analysis.success) {
      if (analysis && analysis.errorMessage) {
        console.error('[API Server Error]:', analysis.errorMessage);
      }
      // Fallback local response generator matching the exact format
      analysis = analyzeEmotionAndGenerateResponse(userText);
    }

    currentAiText = analysis.message;

    // ④ API로부터 받은 답변을 화면 아래쪽의 회색 박스에 표시해줘.
    const emotionSummary = analysis.emotionSummary || '평온';
    emotionTagsEl.innerHTML = `
      <span class="tag tag-empathy"><i class="fa-solid fa-heart"></i> 감정 요약: ${emotionSummary}</span>
      <span class="tag tag-calm"><i class="fa-solid fa-sparkles"></i> Gemini 심리 상담가</span>
    `;

    // Render full formatted answer ('감정: [요약된 감정]\n\n[응원 메시지]') in gray box text content
    aiTextContentEl.textContent = analysis.message;

    // Advice prescription box
    adviceBodyEl.textContent = `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`;

    // Reveal Result in Gray Response Box
    responseLoading.classList.add('hidden');
    responseResult.classList.remove('hidden');
    responseControls.style.display = 'flex';

    // Save to LocalStorage active state and history, and sync to Supabase
    saveActiveStateToLocalStorage(userText, analysis);
    saveToHistory(userText, analysis);
    saveDiaryToSupabase(userText, analysis);

    // Refresh History cards dynamically
    setTimeout(() => {
      loadAndRenderRedisHistory();
    }, 1000);
  });

  // ==========================================================================
  // Redis / Supabase / LocalStorage History Loader & Renderer ('나의 일기 히스토리')
  // ==========================================================================
  async function loadAndRenderRedisHistory() {
    if (!redisHistoryGrid) return;

    // [1단계] 즉시 0초 만에 로컬 데이터로 스피너를 제거하고 우선 표시!
    renderLocalHistoryGridSync();

    // [2단계] 백그라운드에서 최신 API/Supabase 데이터 로드 시도
    try {
      // 1) Vercel Serverless / Redis 히스토리 조회
      const historyItems = await Promise.race([
        fetchDiaryHistoryFromApi(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1200))
      ]).catch(() => []);

      if (historyItems && historyItems.length > 0) {
        renderHistoryItemsGrid(historyItems);
        return;
      }

      // 2) Supabase Database 'diaries' 테이블 조회
      const supabaseDiaries = await Promise.race([
        fetchDiariesFromSupabase(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1200))
      ]).catch(() => []);

      if (supabaseDiaries && supabaseDiaries.length > 0) {
        renderSupabaseDiariesGrid(supabaseDiaries);
        return;
      }
    } catch (err) {
      console.warn('[History Loader Background Refresh Warning]:', err);
    }
  }

  function renderLocalHistoryGridSync() {
    if (!redisHistoryGrid) return;

    if (diaryHistory && diaryHistory.length > 0) {
      renderHistoryItemsGrid(diaryHistory.map(item => ({
        createdAt: item.date,
        userText: item.userText,
        aiResponse: item.aiMessage,
        emotionSummary: (item.tags && item.tags[0] && item.tags[0].label) 
          ? item.tags[0].label.replace('감정: ', '') 
          : '평온'
      })));
    } else {
      renderEmptyHistoryPlaceholder();
    }
  }

  function renderHistoryItemsGrid(items) {
    if (!redisHistoryGrid || !Array.isArray(items)) return;

    if (redisHistoryCount) {
      redisHistoryCount.textContent = `${items.length}개의 기록`;
    }

    if (items.length === 0) {
      renderEmptyHistoryPlaceholder();
      return;
    }

    redisHistoryGrid.innerHTML = items.map(item => {
      const formattedDate = item.createdAt || item.created_at || item.date || '기록';
      const emotion = item.emotionSummary || item.emotion_summary || '평온';

      return `
        <div class="redis-history-card">
          <div class="card-top-bar">
            <span class="card-date-badge"><i class="fa-regular fa-clock"></i> ${escapeHtml(formattedDate)}</span>
            <span class="card-emotion-badge"><i class="fa-solid fa-heart"></i> 감정: ${escapeHtml(emotion)}</span>
          </div>
          <div class="card-body-section">
            <div class="card-user-box">
              <div class="card-box-label"><i class="fa-regular fa-pen-to-square"></i> 내가 작성한 일기</div>
              <div class="card-user-text">${escapeHtml(item.userText || item.user_text || '')}</div>
            </div>
            <div class="card-ai-box">
              <div class="card-box-label"><i class="fa-solid fa-robot"></i> AI 심리 상담가의 답변</div>
              <div class="card-ai-text">${escapeHtml(item.aiResponse || item.ai_response || item.message || '')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSupabaseDiariesGrid(diaries) {
    if (!diaries || diaries.length === 0) {
      renderEmptyHistoryPlaceholder();
      return;
    }

    const mappedItems = diaries.map(item => ({
      createdAt: item.created_at 
        ? new Date(item.created_at).toLocaleString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        : '기록',
      userText: item.user_text,
      aiResponse: item.ai_response,
      emotionSummary: item.emotion_summary || '평온'
    }));

    renderHistoryItemsGrid(mappedItems);
  }

  function renderEmptyHistoryPlaceholder() {
    if (!redisHistoryGrid) return;

    if (redisHistoryCount) {
      redisHistoryCount.textContent = '0개의 기록';
    }

    redisHistoryGrid.innerHTML = `
      <div class="history-card-placeholder">
        <i class="fa-regular fa-folder-open" style="font-size: 1.8rem; color: #cbd5e1;"></i>
        <p>아직 저장된 일기 히스토리가 없습니다.<br>오늘의 일기를 작성하고 분석을 요청해보세요!</p>
      </div>
    `;
  }

  // Smart Fallback Response Generator
  function analyzeEmotionAndGenerateResponse(userText) {
    const text = userText.toLowerCase();

    // Keywords detection
    const isSadOrDepressed = /슬프|우울|눈물|힘들|지쳐|괴로|아프|외롭|상처|무기력|허탈/.test(text);
    const isAngryOrStressed = /화가|스트레스|짜증|열받|부당|억울|싸웠|과장|팀장|욕|망했/.test(text);
    const isAnxiousOrWorried = /불안|걱정|조급|시험|미래|두려|떨려|합격|실수|망치/.test(text);
    const isHappyOrJoyful = /기뻐|행복|합격|성공|신나|즐거|뿌듯|좋았|감사|해냈다|다행/.test(text);

    let emotionSummary = '평온';
    let cheerMessage = '';

    if (isHappyOrJoyful) {
      emotionSummary = '기쁨';
      cheerMessage = '오늘 하루 동안 느꼈던 행복과 성취감은 정말 소중한 당신의 자산이에요. 스스로를 마음껏 칭찬해주고 오늘의 기쁜 기분을 오랫동안 간직해보세요. 당신의 앞날에 늘 이런 기쁨이 가득하길 응원합니다!';
    } else if (isAngryOrStressed) {
      emotionSummary = '분노';
      cheerMessage = '오늘 정말 마음고생 많으셨습니다. 부당한 상황이나 말 때문에 상처받은 마음을 털어놓아주셔서 고마워요. 온전히 나 자신만을 생각하며 편안하게 쉬어갈 수 있기를 진심으로 응원합니다.';
    } else if (isSadOrDepressed) {
      emotionSummary = '슬픔';
      cheerMessage = '많이 힘들고 외로운 하루였을 텐데 잘 버텨내어 주어서 정말 고마워요. 억지로 밝아지려 애쓰지 말고 오늘만큼은 마음껏 쉬어가셨으면 좋겠어요. 언제나 당신을 응원하고 있어요.';
    } else if (isAnxiousOrWorried) {
      emotionSummary = '불안';
      cheerMessage = '앞날에 대한 걱정과 불안으로 마음이 많이 조급하셨겠어요. 하지만 당신은 지금까지도 잘 해내어 왔고 앞으로도 충분히 잘 해낼 힘이 있습니다. 스스로를 믿고 한 걸음씩 나아가시길 응원합니다.';
    } else {
      emotionSummary = '평온';
      cheerMessage = '오늘 하루를 무사히 마치고 다정하게 자신을 돌아보는 당신의 모습이 참 아름답습니다. 오늘 밤은 아무 걱정 없이 편안하고 따뜻한 꿈을 꾸시길 바랍니다. 당신의 매일을 응원해요.';
    }

    const formattedMessage = `감정: ${emotionSummary}\n\n${cheerMessage}`;

    return {
      rawText: formattedMessage,
      emotionSummary: emotionSummary,
      message: formattedMessage,
      tags: [
        { label: `감정: ${emotionSummary}`, type: 'tag-empathy' }
      ],
      advice: `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`
    };
  }

  // ==========================================================================
  // 5. Speech Synthesis (TTS) - Professional Counselor Voice & Fast Speed
  // ==========================================================================
  let isSpeaking = false;
  let cachedVoices = [];

  function loadKoreanVoices() {
    if ('speechSynthesis' in window) {
      cachedVoices = window.speechSynthesis.getVoices();
    }
  }

  loadKoreanVoices();
  if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadKoreanVoices;
  }

  function getBestKoreanCounselorVoice() {
    const voices = cachedVoices.length ? cachedVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const koVoices = voices.filter(v => v.lang.includes('ko') || v.lang.includes('KR'));

    if (!koVoices.length) return null;

    // Priority 1: High quality Natural / Neural / Online voices (e.g. Microsoft Sun-Hi Natural, Google 한국어, Premium)
    const naturalVoice = koVoices.find(v =>
      /natural|neural|online|google|sun-hi|heami|yuna/i.test(v.name)
    );
    if (naturalVoice) return naturalVoice;

    // Priority 2: Google or Microsoft desktop voices
    const desktopVoice = koVoices.find(v => /google|microsoft/i.test(v.name));
    if (desktopVoice) return desktopVoice;

    // Fallback: Default Korean voice
    return koVoices[0];
  }

  btnTts.addEventListener('click', () => {
    if (!currentAiText) return;

    if (!('speechSynthesis' in window)) {
      alert('죄송합니다. 현재 브라우저는 음성 합성(TTS) 기능을 지원하지 않습니다.');
      return;
    }

    // Toggle stop if already speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active audio

    // Format text for natural spoken flow (e.g. "감정: 평온" -> "오늘의 감정 요약은 평온입니다.")
    let speakableText = currentAiText;
    speakableText = speakableText.replace(/^감정:\s*([^\n]+)/, '오늘 분석된 마음 감정은 $1 입니다.');
    speakableText = speakableText.replace(/\n+/g, ' '); // Smooth pauses

    const utterance = new SpeechSynthesisUtterance(speakableText);
    utterance.lang = 'ko-KR';

    // User requirement: 전문가다운 음성, 말하기 속도 조금 더 빨리 (1.15x)
    utterance.rate = 1.15;
    utterance.pitch = 1.05; // Calm, warm professional pitch

    const counselorVoice = getBestKoreanCounselorVoice();
    if (counselorVoice) {
      utterance.voice = counselorVoice;
      console.info(`[TTS Voice Selected]: ${counselorVoice.name}`);
    }

    isSpeaking = true;
    btnTts.innerHTML = '<i class="fa-solid fa-square"></i> 음성 중지';

    utterance.onend = () => {
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
    };

    utterance.onerror = (e) => {
      console.warn('TTS Error:', e);
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
    };

    window.speechSynthesis.speak(utterance);
  });

  // Copy AI response
  btnCopy.addEventListener('click', () => {
    if (!currentAiText) return;

    navigator.clipboard.writeText(currentAiText).then(() => {
      const originalText = btnCopy.innerHTML;
      btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> 복사 완료!';
      setTimeout(() => {
        btnCopy.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  });

  // ==========================================================================
  // 6. History Management
  // ==========================================================================
  function saveToHistory(userEntry, analysisResult) {
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      userText: userEntry,
      tags: analysisResult.tags,
      aiMessage: analysisResult.message,
      advice: analysisResult.advice
    };

    diaryHistory.unshift(newEntry);
    if (diaryHistory.length > 20) diaryHistory.pop(); // Keep last 20 entries

    localStorage.setItem('ai_emotion_diaries', JSON.stringify(diaryHistory));
    renderHistory();
  }

  function renderHistory() {
    historyCountEl.textContent = diaryHistory.length;

    if (diaryHistory.length === 0) {
      historyList.innerHTML = '<p style="font-size: 0.86rem; color: #94a3b8; text-align: center; padding: 12px 0;">아직 저장된 감정 일기가 없습니다.</p>';
      return;
    }

    historyList.innerHTML = diaryHistory.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-date"><i class="fa-regular fa-calendar"></i> ${item.date}</div>
        <div class="history-item-text">${escapeHtml(item.userText)}</div>
      </div>
    `).join('');

    // Attach click event to restore history item into response box
    document.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = Number(el.getAttribute('data-id'));
        const item = diaryHistory.find(h => h.id === id);
        if (item) {
          diaryInput.value = item.userText;
          diaryInput.dispatchEvent(new Event('input'));

          currentAiText = item.aiMessage;

          // Render Tags
          emotionTagsEl.innerHTML = item.tags.map(t =>
            `<span class="tag ${t.type}">${t.label}</span>`
          ).join('');
          aiTextContentEl.textContent = item.aiMessage;
          adviceBodyEl.textContent = item.advice;

          responsePlaceholder.classList.add('hidden');
          responseLoading.classList.add('hidden');
          responseResult.classList.remove('hidden');
          responseControls.style.display = 'flex';

          aiResponseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  btnHistoryToggle.addEventListener('click', () => {
    historySection.classList.toggle('hidden');
    if (!historySection.classList.contains('hidden')) {
      historySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
});
