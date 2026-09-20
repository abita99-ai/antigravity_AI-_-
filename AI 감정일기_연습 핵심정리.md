# 📘 AI 감정일기_연습 핵심정리 가이드

> **목적**: 한 달 후나 추후에 본 프로젝트를 다시 열어보았을 때, 프로젝트의 요구사항 흐름, 개발 진행 단계, Vercel 서버리스 아키텍처 및 핵심 기능을 쉽게 이해하고 친구와 함께 쉽게 실습 및 설명할 수 있도록 정리한 핵심 매뉴얼입니다.

---

## 🛠️ 1. 프로젝트 개요 & 기술 스택

- **프로젝트명**: AI 감정 일기 (`ai-emotion-diary`)
- **핵심 기능**: 
  - 📝 **일기 작성**: 자유로운 다중 행 입력, 입력 칩(Preset) 및 글자 수 카운터
  - 🎙️ **음성 입력**: 브라우저 내장 Web Speech API 기반 음성 인식 & 실시간 텍스트 변환
  - ⚡ **Vercel 서버리스 API (`/api/analyze`)**: 클라이언트 API 키 유출을 100% 방지하는 보안 서버리스 백엔드
  - 🤖 **Gemini AI 감정 분석**: Google Gemini API (`gemini-2.5-flash`) 기반 심리상담가 공감 및 감정 요약
  - 🔊 **음성 읽기 (TTS)**: 고품질 뉴럴(Neural) 보이스 기반 1.15배속 AI 답변 낭독
  - 💾 **데이터 영속성**: LocalStorage 기반 새로고침 후 세션 자동 복원 및 과거 일기 저장소
- **주요 기술 스택**:
  - **Front-end**: HTML5, Vanilla JavaScript (ES Modules), Vite (`v5.4.21`)
  - **Back-end / Serverless**: Vercel Serverless Functions (`Node.js`)
  - **Styling**: Vanilla CSS, Paperlogy (페이퍼로지) 웹 폰트, Glassmorphism & 파스텔 블루 테마
  - **AI SDK**: `@google/genai` (Google Gen AI Official SDK - 서버 측 구동)

---

## 📋 2. 순서별 요구사항 및 Agent 실행 결과

### 1단계: UI 구조 및 디자인 시스템 구축
- **사용자 요구사항**:
  1. Title: `'오늘의 하루는 어땠나요?'` 표시
  2. 입력창: 여러 줄 텍스트 작성이 가능한 넓은 `textarea`
  3. 버튼: 입력창 아래 `'음성으로 입력하기'`, `'분석 요청하기'` 나란히 배치
  4. 하단 영역: `'AI의 답변'` 소제목 + 회색 배경 박스(초기 문구: `'여기에 AI의 답변이 표시됩니다.'`)
  5. 테마/폰트: 밝은 블루톤 배경, **페이퍼로지(Paperlogy)** 폰트 적용
- **Agent 실행 결과**:
  - [`package.json`](file:///c:/HS%20folder/My%20training/%EC%8B%A4%EC%8A%B5_%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/AI%EA%B0%90%EC%A0%95%EC%9D%BC%EA%B8%B0_%EC%97%B0%EC%8A%B5/package.json), [`index.html`](file:///c:/HS%20folder/My%20training/%EC%8B%A4%EC%8A%B5_%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/AI%EA%B0%90%EC%A0%95%EC%9D%BC%EA%B8%B0_%EC%97%B0%EC%8A%B5/index.html), [`style.css`](file:///c:/HS%20folder/My%20training/%EC%8B%A4%EC%8A%B5_%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/AI%EA%B0%90%EC%A0%95%EC%9D%BC%EA%B8%B0_%EC%97%B0%EC%8A%B5/style.css) 생성
  - CDN을 통해 Paperlogy 폰트 (400, 500, 700, 800 굵기) `@font-face` 연동
  - 파스텔 하늘색/블루 그라데이션 배경 및 깔끔한 회색 박스(`background: #f8fafc; border: 1px solid #e2e8f0;`) 구현

---

### 2단계: 웹 음성 인식 (Web Speech API) 기능 추가
- **사용자 요구사항**:
  1. `'음성으로 입력하기'` 클릭 시 브라우저 내장 음성 인식 기능 활성화 (Web Speech API)
  2. 말하는 음성을 텍스트로 변환하여 넓은 입력창에 자동 삽입
  3. 인식 중에는 버튼 텍스트를 `'음성 인식 중...'`으로 변경, 완료 시 다시 `'음성으로 입력하기'`로 복구
- **Agent 실행 결과**:
  - `window.SpeechRecognition` 및 `window.webkitSpeechRecognition` 연동 (`ko-KR` 언어)
  - 인식 중에는 버튼 텍스트를 `'음성 인식 중...'`으로 바꾸고 웨이브폼 애니메이션 표시

---

### 3단계 & 7단계: Vercel 서버리스 아키텍처 및 보안 강화
- **사용자 요구사항**:
  1. 기존 Gemini API 호출을 프론트엔드가 아닌 [`api/analyze.js`](file:///c:/HS%20folder/My%20training/%EC%8B%A4%EC%8A%B5_%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/AI%EA%B0%90%EC%A0%95%EC%9D%BC%EA%B8%B0_%EC%97%B0%EC%8A%B5/api/analyze.js) 서버리스 함수 안으로 이전
  2. `GEMINI_API_KEY` 환경변수가 브라우저에 절대 노출되지 않고 오직 Vercel 서버리스 환경에서만 사용되도록 격리
- **Agent 실행 결과**:
  - [`api/analyze.js`](file:///c:/HS%20folder/My%20training/%EC%8B%A4%EC%8A%B5_%EC%95%88%ED%8B%B0%EA%B7%B8%EB%9E%98%EB%B9%84%ED%8B%B0/AI%EA%B0%90%EC%A0%95%EC%9D%BC%EA%B8%B0_%EC%97%B0%EC%8A%B5/api/analyze.js) Vercel Serverless Function 구축 (`POST /api/analyze`)
  - 서버 측에서만 `process.env.GEMINI_API_KEY`를 읽어 `@google/genai` 호출
  - 프론트엔드 번들 크기 축소 (413 kB ➡️ 10.7 kB로 대폭 경량화) 및 키 유출 위험 완벽 차단

---

### 4단계: '분석 요청하기' 심리상담가 프롬프트 전달
- **사용자 요구사항**:
  1. 지정 프롬프트 전달:
     > *"너는 심리 상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예: 기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메시지를 2~3문장으로 작성해줘. 답변 형식은 반드시 ‘감정: [요약된 감정]\n\n[응원 메시지]’ 와 같이 줄바꿈을 포함해서 보내줘."*
  2. 최신 Flash 모델 (`gemini-2.5-flash`) 사용
- **Agent 실행 결과**:
  - 서버리스 백엔드에서 `gemini-2.5-flash` 모델을 호출하여 `감정: [요약된 감정]\n\n[응원 메시지]` 형식 텍스트 반환
  - 회색 박스내에 직접 렌더링하고 상단에 감정 태그 배지 표시

---

### 5단계: TTS (음성 듣기) 보이스 품질 및 말하기 속도 개선
- **사용자 요구사항**:
  1. 기계음이 아닌 전문가다운 자연스러운 음성 적용
  2. 말하기 속도를 조금 더 빠르게 조율 (1.15배속)
- **Agent 실행 결과**:
  - `getBestKoreanCounselorVoice()`로 고품질 뉴럴(Neural) 한국어 보이스 선택
  - "감정: 평온" 단어를 읽을 때는 "오늘 분석된 마음 감정은 평온 입니다."로 자연스럽게 낭독

---

### 6단계: LocalStorage 데이터 저장 및 새로고침 복원
- **사용자 요구사항**:
  1. `'분석 요청하기'` 완료 시 일기 내용과 AI 답변을 로컬 스토리지에 저장
  2. 페이지 새로고침 시 저장된 내용을 입력창과 AI 답변 박스에 자동 복원
- **Agent 실행 결과**:
  - `saveActiveStateToLocalStorage()` 및 `restoreActiveStateFromLocalStorage()` 구현 완료

---

## 📂 3. 프로젝트 파일 구조

```
AI감정일기_연습/
├── .env                  # Vercel 로컬 서버용 GEMINI_API_KEY 저장
├── .env.example          # 환경변수 템플릿
├── .gitignore            # Git 제외 설정
├── package.json          # 프로젝트 스크립트 및 디펜던시
├── vite.config.js        # Vite 빌드 설정 (보안을 위해 프론트엔드 API 키 정의 제거됨)
├── api/
│   └── analyze.js        # ⚡ Vercel Serverless Function 백엔드 엔드포인트 (/api/analyze)
├── index.html            # 메인 HTML 레이아웃
├── style.css             # 페이퍼로지 폰트, 블루 테마, 회색 박스 스타일링
├── geminiService.js      # 클라이언트 API 요청 핸들러 (fetch('/api/analyze'))
└── main.js               # 음성 인식, TTS, UI 이벤트 및 LocalStorage 복원
```

---

## 🚀 4. Vercel 배포 및 환경변수 설정 가이드

### Vercel 배포 시 환경변수 설정
1. Vercel 대시보드 (`https://vercel.com`)에서 프로젝트 연결
2. **Project Settings ➡️ Environment Variables** 이동
3. 아래의 환경변수를 설정:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: `AIzaSy...발급받은 Gemini API 키...`
4. 배포(Deploy) 버튼을 누르면 `/api/analyze` 서버리스 함수에서 안전하게 Gemini API를 호출합니다.
