import { createClient } from '@supabase/supabase-js'

// Vercel 환경변수(VITE_ / NEXT_PUBLIC_ / SUPABASE_) 또는 .env.local 에서 자동으로 주소를 불러옵니다.
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_PUBLIC_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  import.meta.env.SUPABASE_ANON_KEY

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ==========================================================================
// Supabase Auth (인증) 헬퍼 함수
// ==========================================================================

/**
 * 이메일 / 비밀번호로 로그인
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

/**
 * 이메일 / 비밀번호로 회원가입
 */
export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  return { data, error }
}

/**
 * Google 소셜 로그인
 */
export async function signInWithGoogle() {
  const redirectTo = window.location.origin
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo
    }
  })
  return { data, error }
}

/**
 * 로그아웃
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * 현재 세션의 유저 정보 가져오기
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ==========================================================================
// Supabase Database (일기 데이터) 헬퍼 함수
// ==========================================================================

/**
 * Supabase 'diaries' 테이블에 감정 일기 데이터 저장
 */
export async function saveDiaryToSupabase(userText, analysis) {
  try {
    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('diaries')
      .insert([
        {
          user_id: user ? user.id : null,
          user_text: userText,
          emotion_summary: analysis.emotionSummary || '평온',
          ai_response: analysis.message || '',
          advice: analysis.advice || '',
          created_at: new Date().toISOString()
        }
      ])
      .select()

    if (error) {
      console.warn('[Supabase Insert Warning]:', error.message)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('[Supabase Save Exception]:', err)
    return { success: false, error: err }
  }
}

/**
 * Supabase 'diaries' 테이블에서 최신순으로 일기 목록 조회
 */
export async function fetchDiariesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('diaries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[Supabase Select Warning]:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('[Supabase Fetch Exception]:', err)
    return []
  }
}

// ==========================================================================
// Supabase Realtime Chat 헬퍼 함수
// ==========================================================================

let chatChannel = null;

/**
 * 실시간 채팅 채널 구독 설정
 * @param {Function} onMessageReceived - 메시지 수신 시 실행할 콜백
 */
export function subscribeToRealtimeChat(onMessageReceived) {
  if (!supabase) return null;

  try {
    if (chatChannel) {
      supabase.removeChannel(chatChannel);
    }

    chatChannel = supabase.channel('room-global-chat', {
      config: {
        broadcast: { self: true }
      }
    });

    chatChannel
      .on('broadcast', { event: 'shout' }, payload => {
        if (payload && payload.payload) {
          onMessageReceived(payload.payload);
        }
      })
      .subscribe((status) => {
        console.log('[Supabase Realtime Chat Status]:', status);
      });

    return chatChannel;
  } catch (err) {
    console.warn('[Realtime Subscription Error]:', err);
    return null;
  }
}

/**
 * Supabase 'messages' 테이블에서 기존 모든 메시지 조회 (초기 로딩용)
 */
export async function fetchChatMessagesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[Supabase Messages Fetch Warning]:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('[Supabase Messages Fetch Exception]:', err)
    return []
  }
}

let messagesChannel = null

/**
 * Supabase 'messages' 테이블의 모든 INSERT 이벤트 실시간 구독
 */
export function subscribeToMessagesTable(onMessageReceived) {
  if (!supabase) return null

  try {
    if (messagesChannel) {
      supabase.removeChannel(messagesChannel)
    }

    messagesChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload && payload.new) {
            onMessageReceived(payload.new)
          }
        }
      )
      .subscribe((status) => {
        console.log('[Supabase Messages Realtime Status]:', status)
      })

    return messagesChannel
  } catch (err) {
    console.warn('[Messages Subscription Error]:', err)
    return null
  }
}

/**
 * 실시간 채팅 메시지 전송 (Supabase 'messages' 테이블 insert 및 Realtime broadcast)
 */
export async function sendChatMessage(content, userEmail, avatarUrl = null) {
  // 1. Supabase 'messages' 테이블에 데이터 추가
  let insertObj = {
    content: content,
    user_email: userEmail
  }
  if (avatarUrl) {
    insertObj.avatar_url = avatarUrl
  }

  let { data, error } = await supabase
    .from('messages')
    .insert(insertObj)
    .select()

  // 만약 DB에 avatar_url 컬럼이 없는 경우의 안전한 처리
  if (error && error.message && error.message.includes('avatar_url')) {
    const fallback = await supabase
      .from('messages')
      .insert({
        content: content,
        user_email: userEmail
      })
      .select()
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error('[Supabase Messages Insert Error]:', error.message)
    return { success: false, error }
  }

  const insertedData = data && data[0] ? data[0] : null
  const messagePayload = {
    id: insertedData ? insertedData.id : ('msg-' + Date.now()),
    sender: userEmail || '익명 사용자',
    user_email: userEmail || '익명 사용자',
    avatar_url: avatarUrl || (insertedData ? insertedData.avatar_url : null),
    content: content,
    createdAt: insertedData ? insertedData.created_at : new Date().toISOString()
  }

  // 2. Realtime 채널에도 브로드캐스트 전송
  if (chatChannel) {
    try {
      await chatChannel.send({
        type: 'broadcast',
        event: 'shout',
        payload: messagePayload
      })
    } catch (e) {
      console.warn('[Realtime Broadcast Warning]:', e)
    }
  }

  return { success: true, messagePayload, data }
}

/**
 * 프로필 사진 업로드 및 유저 메타데이터 저장 함수
 * ① 'avatars' 버킷에 [user_id]/avatar.[ext] 경로로 업로드
 * ② 공개 URL (getPublicUrl) 가져오기
 * ③ Supabase Auth 사용자 메타데이터 (avatar_url)에 저장
 */
export async function uploadUserProfileAvatar(file) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: new Error('로그인이 필요한 서비스입니다.') }
    }

    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    // ① Supabase Storage 'avatars' 버킷에 업로드 (upsert: true 로 기존 파일 덮어쓰기)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      console.error('[Supabase Storage Upload Error]:', uploadError.message)
      return { success: false, error: uploadError }
    }

    // ② 공개 URL 가져오기
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // ③ Supabase Auth 사용자 메타데이터에 저장 (data: { avatar_url: URL })
    const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl }
    })

    if (updateError) {
      console.error('[Supabase updateUser Error]:', updateError.message)
      return { success: false, error: updateError, publicUrl }
    }

    return { 
      success: true, 
      publicUrl: publicUrl, 
      user: updatedUserData ? updatedUserData.user : user 
    }
  } catch (err) {
    console.error('[uploadUserProfileAvatar Exception]:', err)
    return { success: false, error: err }
  }
}

/**
 * Supabase Storage 'chat-images' 버킷에 채팅 이미지 파일 업로드
 */
export async function uploadChatImageToSupabase(file) {
  try {
    const user = await getCurrentUser()
    const folder = user ? user.id : 'public'
    const fileExt = file.name.split('.').pop()
    const filePath = `${folder}/chat-${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filePath, file, { upsert: true })

    if (error) {
      console.warn('[Supabase Chat Image Upload Warning]:', error.message)
      return { success: false, error }
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat-images')
      .getPublicUrl(filePath)

    return { success: true, publicUrl: publicUrlData.publicUrl }
  } catch (err) {
    console.error('[uploadChatImageToSupabase Exception]:', err)
    return { success: false, error: err }
  }
}

