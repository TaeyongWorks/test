import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.__ENV__;

if (SUPABASE_URL === "YOUR_SUPABASE_URL") {
    console.error("Supabase URL 및 키가 설정되지 않았습니다. dashboard.html의 window.__ENV__를 수정해주세요.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allJobs = [];
let filterD3 = false;

const jobListElem = document.getElementById('job-list');
const loadingElem = document.getElementById('loading');
const filterStatusElem = document.getElementById('filter-status');
const toggleD3Btn = document.getElementById('toggle-d3');
const refreshBtn = document.getElementById('refresh');

// D-day 계산 함수
function getDDay(deadlineDate) {
    if (!deadlineDate) return '-';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(deadlineDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'D-Day';
    if (diffDays < 0) return `마감 (D${diffDays})`;
    return `D-${diffDays}`;
}

// 데이터 렌더링
function renderJobs() {
    let filtered = allJobs;

    // 상태 필터
    const statusFilter = filterStatusElem.value;
    if (statusFilter !== 'all') {
        filtered = filtered.filter(job => job.status === statusFilter);
    }

    // D-3 필터
    if (filterD3) {
        filtered = filtered.filter(job => {
            if (!job.deadline_date) return false;
            const target = new Date(job.deadline_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 3;
        });
    }

    jobListElem.innerHTML = '';
    
    if (filtered.length === 0) {
        jobListElem.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem;">데이터가 없습니다.</td></tr>';
        return;
    }

    filtered.forEach(job => {
        const dDayStr = getDDay(job.deadline_date);
        const isUrgent = dDayStr.includes('D-') && parseInt(dDayStr.replace('D-', '')) <= 3;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${job.company || '-'}</td>
            <td>${job.title || '-'}</td>
            <td style="font-size: 0.8rem; color: #94a3b8;">${job.deadline_raw || '-'}</td>
            <td class="d-day-badge ${isUrgent ? 'd-day-urgent' : ''}">${dDayStr}</td>
            <td>
                <select class="status-select" data-id="${job.id}">
                    <option value="대기" ${job.status === '대기' ? 'selected' : ''}>대기</option>
                    <option value="지원완료" ${job.status === '지원완료' ? 'selected' : ''}>지원완료</option>
                    <option value="서류통과" ${job.status === '서류통과' ? 'selected' : ''}>서류통과</option>
                    <option value="최종합격" ${job.status === '최종합격' ? 'selected' : ''}>최종합격</option>
                    <option value="불합격" ${job.status === '불합격' ? 'selected' : ''}>불합격</option>
                </select>
            </td>
            <td>
                <input type="text" class="memo-input" data-id="${job.id}" value="${job.memo || ''}" placeholder="메모 입력...">
            </td>
            <td><a href="${job.url}" target="_blank">링크 ↗</a></td>
        `;
        jobListElem.appendChild(tr);
    });
}

// 데이터 불러오기
async function fetchJobs() {
    loadingElem.style.display = 'block';
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('deadline_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching jobs:', error);
        alert('데이터를 가져오는데 실패했습니다.');
    } else {
        allJobs = data;
        renderJobs();
    }
    loadingElem.style.display = 'none';
}

// 상태 업데이트
async function updateStatus(id, status) {
    const { error } = await supabase
        .from('jobs')
        .update({ status, updated_at: new Date() })
        .eq('id', id);
    
    if (error) {
        console.error('Error updating status:', error);
        alert('상태 업데이트 실패');
    }
}

// 메모 업데이트
async function updateMemo(id, memo) {
    const { error } = await supabase
        .from('jobs')
        .update({ memo, updated_at: new Date() })
        .eq('id', id);
    
    if (error) {
        console.error('Error updating memo:', error);
        alert('메모 업데이트 실패');
    }
}

// 이벤트 리스너
jobListElem.addEventListener('change', async (e) => {
    if (e.target.classList.contains('status-select')) {
        const id = e.target.dataset.id;
        const status = e.target.value;
        await updateStatus(id, status);
    }
});

jobListElem.addEventListener('blur', async (e) => {
    if (e.target.classList.contains('memo-input')) {
        const id = e.target.dataset.id;
        const memo = e.target.value;
        await updateMemo(id, memo);
    }
}, true);

filterStatusElem.addEventListener('change', renderJobs);

toggleD3Btn.addEventListener('click', () => {
    filterD3 = !filterD3;
    toggleD3Btn.classList.toggle('active', filterD3);
    renderJobs();
});

refreshBtn.addEventListener('click', fetchJobs);

// 초기화
fetchJobs();
