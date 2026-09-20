// ==========================================================================
// MBTI 성격 유형 테스트 Data & Logic (랜덤 질문/선택지 & 16개 캐릭터 연동)
// ==========================================================================

// 1. 점수 변수 선언 (E, S, T, J 지표를 0으로 시작)
let scoreE = 0;
let scoreS = 0;
let scoreT = 0;
let scoreJ = 0;

// 진행 상태 변수
let currentQuestionIndex = 0;
let activeQuestions = [];
let currentOptions = []; // 현재 질문의 무작위 셔플된 선택지 저장

// 2. 각 지표별 2배 확충된 총 16개의 질문 데이터 풀 (지표별 4문항씩)
const questionPool = {
    EI: [
        {
            id: 1,
            question: '주말에 약속이 없다면 나는?',
            optionA: { text: '집에 있는다', scoreType: 'I' },
            optionB: { text: '밖에 나가서 사람들을 만난다', scoreType: 'E' }
        },
        {
            id: 2,
            question: '새로운 사람을 만날 때 나는?',
            optionA: { text: '새로운 사람을 만나는 것은 즐겁다', scoreType: 'E' },
            optionB: { text: '피곤하고 기가 빨린다', scoreType: 'I' }
        },
        {
            id: 3,
            question: '스트레스를 받았을 때 나를 리프레시하는 방법은?',
            optionA: { text: '혼자 차분히 영화를 보거나 음악 감상하기', scoreType: 'I' },
            optionB: { text: '친구들을 불러 신나게 이야기하고 놀기', scoreType: 'E' }
        },
        {
            id: 4,
            question: '자기소개나 사람들 앞에서 발표를 해야 할 때 나는?',
            optionA: { text: '나를 표현하고 주목받는 상황이 즐겁다', scoreType: 'E' },
            optionB: { text: '쑥스럽고 주목받는 상황이 다소 부담스럽다', scoreType: 'I' }
        }
    ],
    SN: [
        {
            id: 5,
            question: '무언가를 바라보고 이해할 때 나는?',
            optionA: { text: '나무보다 숲을 먼저 본다', scoreType: 'N' },
            optionB: { text: '숲보다 나무를 먼저 본다', scoreType: 'S' }
        },
        {
            id: 6,
            question: '나에게 더 가치 있게 느껴지는 것은?',
            optionA: { text: '미래의 가능성보다 현재의 사실이 중요하다', scoreType: 'S' },
            optionB: { text: '현재의 사실보다 미래의 가능성이 중요하다', scoreType: 'N' }
        },
        {
            id: 7,
            question: '사과라는 단어를 들었을 때 머릿속에 드는 생각은?',
            optionA: { text: '빨갛고 맛있고 새콤달콤한 디저트 과일', scoreType: 'S' },
            optionB: { text: '백설공주, 사과잼, 애플(Apple) 회사의 혁신 아이콘', scoreType: 'N' }
        },
        {
            id: 8,
            question: '새 제품 가전제품을 조립할 때 스타일은?',
            optionA: { text: '설명서의 1단계부터 차근차근 읽고 순서대로 조립', scoreType: 'S' },
            optionB: { text: '설명서는 대충 흘려보고 느낌과 직관으로 조립', scoreType: 'N' }
        }
    ],
    TF: [
        {
            id: 9,
            question: '친구가 슬퍼할 때 나의 반응은?',
            optionA: { text: '해결책을 제시한다', scoreType: 'T' },
            optionB: { text: '먼저 공감하고 위로한다', scoreType: 'F' }
        },
        {
            id: 10,
            question: '중요한 결정을 내릴 때 나는?',
            optionA: { text: '사실과 논리가 중요하다', scoreType: 'T' },
            optionB: { text: '다른 사람의 감정을 고려하는 것이 중요하다', scoreType: 'F' }
        },
        {
            id: 11,
            question: '누군가 업무 중 실수를 했을 때 드는 첫 생각은?',
            optionA: { text: '왜 그런 오류가 생겼는지 원인 분석 및 대책 마련', scoreType: 'T' },
            optionB: { text: '실수한 당사자의 마음이 얼마나 당황스럽고 속상할까 걱정', scoreType: 'F' }
        },
        {
            id: 12,
            question: '내가 더 기분 좋게 느끼는 칭찬은?',
            optionA: { text: '"너 진짜 일 잘한다! 완전 똑똑해!"', scoreType: 'T' },
            optionB: { text: '"너 없었으면 어쩔 뻔했어, 진짜 고마워!"', scoreType: 'F' }
        }
    ],
    JP: [
        {
            id: 13,
            question: '여행을 떠날 때 나의 스타일은?',
            optionA: { text: '계획을 철저히 세운다', scoreType: 'J' },
            optionB: { text: '즉흥적으로 발길 닿는 대로 다닌다', scoreType: 'P' }
        },
        {
            id: 14,
            question: '일을 진행할 때 마감일에 대해 드는 생각은?',
            optionA: { text: '마감일이 정해져 있어야 일이 잘된다', scoreType: 'J' },
            optionB: { text: '마감일은 나에게 스트레스일 뿐이다', scoreType: 'P' }
        },
        {
            id: 15,
            question: '내 방이나 책상 공간 정리 정돈 스타일은?',
            optionA: { text: '항상 정해진 위치에 깔끔하게 정리되어 있음', scoreType: 'J' },
            optionB: { text: '자유롭게 어질러져 있어도 내 위치는 다 알고 있음', scoreType: 'P' }
        },
        {
            id: 16,
            question: '갑자기 예정된 주말 스케줄이 전부 취소되었을 때 나는?',
            optionA: { text: '갑작스러운 변수에 살짝 당황하고 새 일정을 재수립', scoreType: 'J' },
            optionB: { text: '"오히려 좋아!" 자유 시간을 즐기며 흥미롭게 대처', scoreType: 'P' }
        }
    ]
};

// 3. 16가지 MBTI 유형별 결과 정보 (잘라낸 16개 귀여운 3D 캐릭터 이미지 연결)
const mbtiResults = {
    ENFP: {
        nickname: '재기발랄한 활동가',
        oneLine: '"상상력과 열정이 넘치는 세상의 자유로운 에너지왕!"',
        humorQuote: '친구가 "나 우울해서 쇼핑했어" ➔ "뭐 샀어?! 대박 나도 사고 싶다! 쇼핑몰 주소 공유해줘!! 🛍️"',
        image: 'images/mbti_ENFP.png'
    },
    ENTP: {
        nickname: '뜨거운 논쟁을 즐기는 변론가',
        oneLine: '"질문과 호기심이 끊이지 않는 상상 초월 유쾌한 토론 왕!"',
        humorQuote: '누가 "원래 다 그렇게 해~" 라고 할 때 ➔ "원래가 뭔데요? 왜 그래야 하죠? 다른 가능성은요? 😈"',
        image: 'images/mbti_ENTP.png'
    },
    ENFJ: {
        nickname: '정의로운 주인공',
        oneLine: '"타인의 성장을 돕고 따뜻한 에너지를 나누는 인간 비타민 리더!"',
        humorQuote: '친구가 의소침해 있을 때 ➔ "너는 진짜 누구보다 빛나는 사람이야! 할 수 있어, 내가 곁에서 응원할게! 💖"',
        image: 'images/mbti_ENFJ.png'
    },
    ENTJ: {
        nickname: '대담한 통솔자',
        oneLine: '"확실한 비전과 강력한 실행력으로 목표를 정복하는 카리스마 리더!"',
        humorQuote: '팀 프로젝트 시작할 때 ➔ "자, 5분 안에 역할을 나누고 금요일 6시까지 제출하세요. 목표는 1등입니다. 🚀"',
        image: 'images/mbti_ENTJ.png'
    },
    ESFP: {
        nickname: '자유로운 영혼의 연예인',
        oneLine: '"오늘을 신나게 즐기는 파티의 주인공! 분위기 메이커!"',
        humorQuote: '침묵이 3초 이상 흐를 때 ➔ "아 갑자기 분위기 왜 이래?! 얘들아 당장 노래방 가자!! 🎶"',
        image: 'images/mbti_ESFP.png'
    },
    ESTP: {
        nickname: '수완 좋은 모험가',
        oneLine: '"생각보다 행동이 먼저! 즉흥적이고 시원시원한 만능 해결사!"',
        humorQuote: '복잡한 고민을 들었을 때 ➔ "아 고민 그만하고 일단 가서 부딪혀봐! 되면 좋고 안 되면 딴 거 해! 👊"',
        image: 'images/mbti_ESTP.png'
    },
    ESFJ: {
        nickname: '사교적인 협력자',
        oneLine: '"주변 사람 챙기기가 취미인 세심하고 공감 능력 만렙 조력자!"',
        humorQuote: '모임에서 ➔ "너 이 과자 좋아하지? 챙겨둬! 물 더 필요해? 휴지 가져다줄까? 🍪"',
        image: 'images/mbti_ESFJ.png'
    },
    ESTJ: {
        nickname: '엄격한 관리자',
        oneLine: '"질서와 현실적인 결과를 중시하는 확실한 실행력의 정석!"',
        humorQuote: '약속 시간에 1분 늦었을 때 ➔ "12시 01분이야. 스케줄 동선 차질 생기니까 빠르게 출발하자. ⏱️"',
        image: 'images/mbti_ESTJ.png'
    },
    INFP: {
        nickname: '열정적인 중재자',
        oneLine: '"겉은 말랑말랑 감성파, 속은 자기만의 신념으로 가득 찬 예술가!"',
        humorQuote: '길 가다 길고양이를 보았을 때 ➔ "안녕 고양이야... 추운 겨울을 잘 보낼 보금자리는 있니? (속으로 눈물 핑 🥺)"',
        image: 'images/mbti_INFP.png'
    },
    INTP: {
        nickname: '논리적인 사색가',
        oneLine: '"지적 호기심 100%! 세상의 모든 원리를 탐구하는 아웃사이더 천재!"',
        humorQuote: '대화 중 뜬금없이 ➔ "근데... 우주 너머엔 뭐가 있을까? 만약 물리 법칙이 반대로 작동한다면? 🤔"',
        image: 'images/mbti_INTP.png'
    },
    INFJ: {
        nickname: '선의의 옹호자',
        oneLine: '"조용하지만 깊은 통찰력으로 사람들을 따뜻하게 지켜보는 마음 멘토!"',
        humorQuote: '친구가 "나 우울해..." ➔ "속상했겠다... 따뜻한 차 마시면서 너의 이야기 차근차근 다 들어줄게. 🍵"',
        image: 'images/mbti_INFJ.png'
    },
    INTJ: {
        nickname: '용의주도한 전략가',
        oneLine: '"모든 상황엔 솔루션이 존재한다! 3수 앞을 내다보는 전략 마스터!"',
        humorQuote: '친구가 "나 일하기 싫어..." ➔ "퇴사 후 6개월 생활비 자금과 다음 직장 이력서 일정은 짜뒀어? 📊"',
        image: 'images/mbti_INTJ.png'
    },
    ISFP: {
        nickname: '호기심 많은 예술가',
        oneLine: '"침대 위 이불 속이 제일 편하지만 은근 유연하고 겸손한 평화주의자!"',
        humorQuote: '주말 약속이 취소되었을 때 ➔ "(속마음: 앗싸 대박!! 집에서 넷플릭스 봐야지 🥳) 아쉬워라~ 다음엔 꼭 보자!"',
        image: 'images/mbti_ISFP.png'
    },
    ISTP: {
        nickname: '만능 재주꾼',
        oneLine: '"말보다는 실전! 과묵하지만 도구와 문제 해결에 탁월한 장인!"',
        humorQuote: '물건이 고장 났을 때 ➔ "말 길게 하지 마. 드라이버 가져와 봐. 뚝딱뚝딱... 고쳤다. 🛠️"',
        image: 'images/mbti_ISTP.png'
    },
    ISFJ: {
        nickname: '용감한 수호자',
        oneLine: '"티 내지 않고 묵묵히 챙겨주는 세심하고 든든한 다정한 수호자!"',
        humorQuote: '친구가 아프다고 할 때 ➔ "약 먹었어? 내가 따뜻한 죽 모바일 쿠폰 보내줄 테니까 꼭 쉬어! 💊"',
        image: 'images/mbti_ISFJ.png'
    },
    ISTJ: {
        nickname: '청렴결백한 논리주의자',
        oneLine: '"약속과 기한은 필수! 정직하고 철저한 원칙주의 대표주자!"',
        humorQuote: '"대충 하자~"라는 말을 들었을 때 ➔ "\'대충\'이라는 지침은 없습니다. 매뉴얼 규칙대로 정확히 진행하세요. 📖"',
        image: 'images/mbti_ISTJ.png'
    }
};

// 4. 배열 무작위 셔플 헬퍼 함수 (Fisher-Yates 알고리즘)
function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 5. 핵심 제어 함수

// [테스트 시작 - 무작위 질문 세트 추출 및 무작위 질문 순서 셔플]
window.startTest = function () {
    // 점수 변수 및 인덱스 초기화
    scoreE = 0;
    scoreS = 0;
    scoreT = 0;
    scoreJ = 0;
    currentQuestionIndex = 0;

    // 1) 각 지표별 4문항 중 무작위 2문항씩 추출 (총 8개)
    const selectedEI = shuffleArray(questionPool.EI).slice(0, 2);
    const selectedSN = shuffleArray(questionPool.SN).slice(0, 2);
    const selectedTF = shuffleArray(questionPool.TF).slice(0, 2);
    const selectedJP = shuffleArray(questionPool.JP).slice(0, 2);

    // 2) 8개 질문을 하나로 합친 후, 전체 질문 순서를 완전히 무작위로 섞음!
    const combinedQuestions = [...selectedEI, ...selectedSN, ...selectedTF, ...selectedJP];
    activeQuestions = shuffleArray(combinedQuestions);

    const startScreen = document.getElementById('start-screen');
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');

    if (startScreen) startScreen.classList.add('hidden');
    if (resultScreen) resultScreen.classList.add('hidden');
    if (questionScreen) {
        questionScreen.classList.remove('hidden');
        questionScreen.classList.add('fade-in');
    }

    renderQuestion();
};

// [답변 선택 시 점수 누적 처리]
window.selectOption = function (choiceIdx) {
    if (currentQuestionIndex >= activeQuestions.length) return;

    // 선택한 버튼의 점수 타겟 (E, S, T, J 또는 I, N, F, P)
    const selectedOption = currentOptions[choiceIdx];
    const selectedType = selectedOption.scoreType;

    // 지표 점수 획득 규칙
    if (selectedType === 'E') {
        scoreE += 1;
    } else if (selectedType === 'S') {
        scoreS += 1;
    } else if (selectedType === 'T') {
        scoreT += 1;
    } else if (selectedType === 'J') {
        scoreJ += 1;
    }

    currentQuestionIndex++;

    if (currentQuestionIndex < activeQuestions.length) {
        renderQuestion();
    } else {
        showResult();
    }
};

// [질문 및 무작위 선택지 랜더링]
function renderQuestion() {
    const qData = activeQuestions[currentQuestionIndex];

    const qNumberEl = document.getElementById('question-number');
    const qStepEl = document.getElementById('question-step');
    const qTextEl = document.getElementById('question-text');
    const optATextEl = document.getElementById('option-a-text');
    const optBTextEl = document.getElementById('option-b-text');
    const progressBar = document.getElementById('progress-bar');
    const questionScreen = document.getElementById('question-screen');

    // 선택지 순서 무작위 셔플 (A와 B 순서 섞기)
    const options = [qData.optionA, qData.optionB];
    currentOptions = shuffleArray(options);

    if (qNumberEl) qNumberEl.textContent = `Q${currentQuestionIndex + 1}.`;
    if (qStepEl) qStepEl.textContent = `${currentQuestionIndex + 1} / ${activeQuestions.length}`;
    if (qTextEl) qTextEl.textContent = qData.question;
    
    // 무작위 셔플된 선택지 바인딩
    if (optATextEl) optATextEl.textContent = currentOptions[0].text;
    if (optBTextEl) optBTextEl.textContent = currentOptions[1].text;

    // 선택지 버튼 onclick 핸들러에 인덱스 전달 (0 또는 1)
    const optABtn = document.getElementById('option-a');
    const optBBtn = document.getElementById('option-b');
    if (optABtn) optABtn.setAttribute('onclick', 'selectOption(0)');
    if (optBBtn) optBBtn.setAttribute('onclick', 'selectOption(1)');

    // 프로그레스 바
    if (progressBar) {
        const progressPercent = ((currentQuestionIndex + 1) / activeQuestions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }

    if (questionScreen) {
        questionScreen.classList.remove('fade-in');
        void questionScreen.offsetWidth; // Reflow
        questionScreen.classList.add('fade-in');
    }
}

// [최종 결과 화면 표시]
function showResult() {
    // 최종 MBTI 판별
    let finalMBTI = '';
    finalMBTI += (scoreE >= 1) ? 'E' : 'I';
    finalMBTI += (scoreS >= 1) ? 'S' : 'N';
    finalMBTI += (scoreT >= 1) ? 'T' : 'F';
    finalMBTI += (scoreJ >= 1) ? 'J' : 'P';

    const resultInfo = mbtiResults[finalMBTI] || mbtiResults['ENFP'];

    // DOM 요소
    const resultMbtiTypeEl = document.getElementById('result-mbti-type');
    const resultNicknameEl = document.getElementById('result-nickname');
    const resultOneLineEl = document.getElementById('result-one-line');
    const resultHumorQuoteEl = document.getElementById('result-humor-quote');
    const resultCharImgEl = document.getElementById('result-char-img');

    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');

    // 결과 데이터 및 16개 크롭 캐릭터 이미지 경로 연결!
    if (resultMbtiTypeEl) resultMbtiTypeEl.textContent = finalMBTI;
    if (resultNicknameEl) resultNicknameEl.textContent = resultInfo.nickname;
    if (resultOneLineEl) resultOneLineEl.textContent = resultInfo.oneLine;
    if (resultHumorQuoteEl) resultHumorQuoteEl.textContent = resultInfo.humorQuote;
    if (resultCharImgEl) {
        resultCharImgEl.src = resultInfo.image;
        resultCharImgEl.alt = `${finalMBTI} ${resultInfo.nickname}`;
    }

    // 화면 전환
    if (questionScreen) questionScreen.classList.add('hidden');
    if (resultScreen) {
        resultScreen.classList.remove('hidden');
        resultScreen.classList.add('fade-in');
    }
}

// [다시 테스트하기]
window.restartTest = function () {
    const startScreen = document.getElementById('start-screen');
    const questionScreen = document.getElementById('question-screen');
    const resultScreen = document.getElementById('result-screen');

    if (questionScreen) questionScreen.classList.add('hidden');
    if (resultScreen) resultScreen.classList.add('hidden');
    if (startScreen) {
        startScreen.classList.remove('hidden');
        startScreen.classList.add('fade-in');
    }
};

// DOMContentLoaded 리스너
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', window.startTest);
    }
});
