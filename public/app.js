  let menus = [];
  let sort = 'top';
function showToast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  }

  function getUser() {
    let id = getCookie('voter-id') || localStorage.getItem('voter-id');
    if (!id) { id = Math.random().toString(36).slice(2); }
    setCookie('voter-id', id, 365);
    localStorage.setItem('voter-id', id);
    return id;
  }
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, val, days) {
    const d = new Date(); d.setTime(d.getTime() + days*86400000);
    document.cookie = name + '=' + encodeURIComponent(val) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function relativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  }

  async function fetchMenus() {
    try {
      const res = await fetch('/api/menus');
      menus = await res.json();
    } catch(e) {
      menus = [];
      showToast('서버에 연결할 수 없습니다');
    }
    renderMenus();
  }

  async function refreshScores() {
    const res = await fetch('/api/menus');
    const updated = await res.json();
    updated.forEach(u => {
      const existing = menus.find(m => m.id === u.id);
      if (existing) existing.score = u.score;
      const el = document.getElementById(`score-${u.id}`);
      if (el) el.textContent = u.score;
    });
  }

  function sortedMenus() {
    return [...menus].sort((a, b) => {
      if (sort === 'top') return b.score - a.score || new Date(b.created_at) - new Date(a.created_at);
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  function renderMenus() {
    const list = document.getElementById('menu-list');
    const sorted = sortedMenus();
    if (!sorted.length) {
      list.innerHTML = '<div class="empty-state"><div class="icon">🥺</div><p>추천이 없습니다... 하나 하고 가세요</p></div>';
      return;
    }
    list.innerHTML = sorted.map(m => menuCard(m)).join('');
    sorted.forEach(m => attachMenuHandlers(m.id));
    // mark previously voted hearts
    const voted = JSON.parse(localStorage.getItem('voted-ids') || '[]');
    const filledPath = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z";
    voted.forEach(id=>{const btn=document.querySelector('.vote-btn[data-id="'+id+'"]');if(btn){btn.classList.add('active');btn.querySelector('path').setAttribute('d',filledPath);}});
  }

  function menuCard(m, opts = {}) {
    const { metaLine, showMenu, idPrefix, stopPropagation } = Object.assign({
      metaLine: `${relativeTime(m.created_at)} · 독서합시다`,
      showMenu: true,
      idPrefix: '',
      stopPropagation: false,
    }, opts);
    const sp = stopPropagation ? 'event.stopPropagation();' : '';
    const cardId = idPrefix ? `${idPrefix}-card-${m.id}` : `card-${m.id}`;
    return `
      <div class="menu-card" id="${cardId}">
        <div class="menu-card-body" data-menu-id="${m.id}">
          <div class="post-header">
            <div class="post-header-left">
              <div class="post-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="" width="32" height="32"></div>
              <div class="post-header-info">
                <div class="post-author-badge">${m.author ? escHtml(m.author) : '익명'}</div>
                <span class="post-meta-line">${metaLine}</span>
              </div>
            </div>
            ${showMenu ? `<div class="post-more-wrapper">
              <button class="post-more-btn" aria-label="더보기" type="button" onclick="this.nextElementSibling.classList.toggle('show')"><svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.125 12a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-6.25 0a1.875 1.875 0 1 1-3.751 0 1.875 1.875 0 0 1 3.751 0ZM5.75 13.875a1.875 1.875 0 1 1 0-3.75 1.875 1.875 0 0 1 0 3.75Z" fill="currentcolor"></path></svg></button>
              <div class="post-dropdown" ${m.created_by === getUser() ? '' : 'style="display:none"'}>
                <button onclick="editPost(${m.id})">수정</button>
                <button onclick="deletePost(${m.id})">삭제</button>
              </div>
            </div>` : ''}
          </div>
          <div class="post-content">
            ${m.restaurant ? `<h2 class="post-title">${m.submitted_by ? `<a href="${escHtml(m.submitted_by)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${escHtml(m.restaurant)}</a>` : escHtml(m.restaurant)}</h2>` : ''}
            <p class="post-body" style="white-space:pre-wrap">${escHtml(m.title)}</p>
          </div>
          <div class="post-actions">
            <div class="post-actions-left">
              <button class="vote-btn up" data-id="${m.id}" onclick="${sp}vote(${m.id}, 1)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z" fill="currentcolor"/></svg><span id="${idPrefix}score-${m.id}">${m.score || 0}</span></button>
              <button class="toggle-comments" data-id="${m.id}" onclick="${sp}toggleComments(${m.id}, this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6.832 17.535a1.877 1.877 0 0 1 1.742-.25c1.035.375 2.194.59 3.428.59 4.87 0 8.123-3.145 8.123-6.25s-3.253-6.25-8.123-6.25c-4.87 0-8.122 3.145-8.122 6.25 0 1.25.484 2.453 1.394 3.484.336.38.5.88.46 1.387a6.92 6.92 0 0 1-.44 1.93 9.811 9.811 0 0 0 1.538-.887v-.004Zm-3.999 1.586c.07-.105.137-.21.2-.316.39-.649.76-1.5.835-2.457-1.172-1.332-1.863-2.961-1.863-4.723 0-4.488 4.475-8.125 9.997-8.125C17.526 3.5 22 7.137 22 11.625c0 4.488-4.475 8.125-9.998 8.125-1.448 0-2.823-.25-4.065-.7-.465.34-1.222.805-2.12 1.196a9.564 9.564 0 0 1-1.957.629c-.031.008-.062.012-.094.02-.171.03-.34.058-.515.074-.008 0-.02.004-.027.004-.2.02-.399.03-.598.03a.625.625 0 0 1-.445-1.066 5.606 5.606 0 0 0 .629-.797l.011-.019h.012Z" fill="currentcolor"/></svg>${m.comment_count || 0}</button>
            </div>
            <div class="post-actions-right">
              <button class="post-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 4.875C4.5 3.84 5.34 3 6.375 3v16.242l5.082-3.629a.93.93 0 0 1 1.09 0l5.078 3.63V4.874H6.375V3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762z" fill="currentColor"/></svg></button>
              <button class="post-icon-btn share-btn" data-link="${escHtml(m.submitted_by || '')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12.664 2.275a.934.934 0 0 0-1.324 0l-5.004 5A.937.937 0 0 0 7.66 8.6l3.399-3.398v9.614c0 .519.418.937.937.937.52 0 .938-.418.938-.938V5.202L16.332 8.6a.937.937 0 0 0 1.324-1.324l-4.992-5ZM5.125 15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124a3.438 3.438 0 0 0 3.438 3.438h10.625a3.438 3.438 0 0 0 3.437-3.438V15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124c0 .864-.7 1.563-1.563 1.563H6.688c-.863 0-1.562-.7-1.562-1.563V15.44Z" fill="currentColor"/></svg></button>
            </div>
          </div>
          ${m.description ? `<div class="post-comment-bubble" onclick="${sp}toggleComments(${m.id}, this)"><div class="post-comment-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" width="24" height="24" alt=""></div><p class="post-comment-text">${escHtml(m.description)}</p></div>` : ''}
          <div class="comments-section" id="${idPrefix}comments-${m.id}">
            <div id="${idPrefix}comment-list-${m.id}"></div>
            <div class="add-comment-form">
              <div class="comment-input-header"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt=""><span>익명</span></div>
              <textarea id="${idPrefix}comment-text-${m.id}" placeholder="공감할래말래" rows="1" ${stopPropagation ? 'onclick="event.stopPropagation()"' : ''}></textarea>
              <div class="comment-form-row"><button class="btn" onclick="${sp}submitComment(${m.id}, this)">등록</button></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachMenuHandlers(id) {
    const card = document.querySelector(`#feed-view #card-${id}`);
    if (!card) return;
    const voteBtn = card.querySelector(`.vote-btn[data-id="${id}"]`);
    if (voteBtn) voteBtn.addEventListener('click', () => vote(id, 1));
    const commentBtn = card.querySelector(`.toggle-comments[data-id="${id}"]`);
    if (commentBtn) commentBtn.addEventListener('click', (e) => toggleComments(id, e.currentTarget));
    const shareBtn = card.querySelector('.share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        const link = shareBtn.getAttribute('data-link');
        if (link) { navigator.clipboard.writeText(link); showToast('링크가 복사되었습니다!'); }
        else { showToast('링크가 없습니다'); }
      });
    }
  }

  async function vote(menuId, value) {
    const res = await fetch(`/api/menus/${menuId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter: getUser(), value })
    });
    if (!res.ok) { showToast('Vote failed.'); return; }
    const { score } = await res.json();
    // Update ALL instances of this card across all tabs
    document.querySelectorAll(`[id$="score-${menuId}"]`).forEach(el => el.textContent = score);
    const isNowVoted = !JSON.parse(localStorage.getItem('voted-ids') || '[]').includes(menuId);
    const filled = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z";
    const outlined = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z";
    document.querySelectorAll(`.vote-btn[data-id="${menuId}"]`).forEach(btn => {
      if (isNowVoted) btn.classList.add('active'); else btn.classList.remove('active');
      btn.querySelector('path').setAttribute('d', isNowVoted ? filled : outlined);
    });
    // persist vote state locally
    let voted = JSON.parse(localStorage.getItem('voted-ids') || '[]');
    if (isNowVoted) { if (!voted.includes(menuId)) voted.push(menuId); }
    else { voted = voted.filter(x => x !== menuId); }
    localStorage.setItem('voted-ids', JSON.stringify(voted));
    const menu = menus.find(m => m.id === menuId);
    if (menu) menu.score = score;
  }

  async function toggleComments(menuId, triggerEl) {
    // Find the closest card container, then find the comments section within it
    const card = triggerEl ? triggerEl.closest('.menu-card, .match-card') : document.getElementById(`card-${menuId}`);
    if (!card) return;
    const section = card.querySelector('.comments-section');
    if (!section) return;
    const open = section.classList.toggle('open');
    if (open) await loadCommentsInEl(menuId, card);
  }

  async function loadCommentsInEl(menuId, card) {
    const listEl = card.querySelector('[id$="comment-list-' + menuId + '"], .comment-list');
    // Fallback: find any child that looks like a comment list container
    const target = listEl || card.querySelector('.comments-section > div:first-child');
    if (!target) return;
    let comments;
    try {
      const res = await fetch(`/api/menus/${menuId}/comments`);
      comments = await res.json();
    } catch(e) { comments = []; }
    if (!comments.length) { target.innerHTML = ''; return; }
    target.innerHTML = comments.map(c => `
      <div class="comment-item">
        <img class="comment-avatar" src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="">
        <div class="comment-body">
          <div class="comment-header">
            <span class="comment-nickname">익명</span>
            <span class="comment-time">${relativeTime(c.created_at)}</span>
          </div>
          <div class="comment-text">${escHtml(c.content)}</div>
          ${c.preferences ? `<span class="comment-pref">🥗 ${escHtml(c.preferences)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  async function loadComments(menuId) {
    // Legacy: load comments into ALL visible instances of this card
    document.querySelectorAll(`[data-menu-id="${menuId}"]`).forEach(cardBody => {
      const card = cardBody.closest('.menu-card');
      if (card) loadCommentsInEl(menuId, card);
    });
  }

  async function submitComment(menuId, triggerEl) {
    const card = triggerEl ? triggerEl.closest('.menu-card, .match-card') : document.getElementById(`card-${menuId}`);
    if (!card) return;
    const contentEl = card.querySelector('textarea[id$="comment-text-' + menuId + '"], textarea');
    if (!contentEl) return;
    const content = contentEl.value.trim();
    if (!content) { showToast('댓글을 입력해주세요'); return; }

    const res = await fetch(`/api/menus/${menuId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: getUser(), content })
    });

    if (!res.ok) { showToast('댓글 등록 실패'); return; }

    contentEl.value = '';
    showToast('댓글이 등록되었습니다!');
    // Reload comments in ALL visible instances of this card
    document.querySelectorAll(`[data-menu-id="${menuId}"]`).forEach(cardBody => {
      const c = cardBody.closest('.menu-card, .match-card');
      if (c && c.querySelector('.comments-section.open')) loadCommentsInEl(menuId, c);
    });

    const menu = menus.find(m => m.id === menuId);
    if (menu) menu.comment_count = (menu.comment_count || 0) + 1;
  }

  document.getElementById('submit-menu-btn').addEventListener('click', async () => {
    const title = document.getElementById('menu-title').value.trim();
    const restaurant = document.getElementById('menu-restaurant').value.trim();
    const author = document.getElementById('menu-author').value.trim();
    const submitter = document.getElementById('menu-submitter').value.trim();
    const desc = document.getElementById('menu-desc').value.trim();
    if (!title) { showToast('명대사를 적어주세요.'); return; }

    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, restaurant, description: desc, submitted_by: submitter || '', author: author || '', created_by: getUser() })
    });

    if (!res.ok) { showToast('추천 실패'); return; }
    const menu = await res.json();
    menus.unshift(menu);
    document.getElementById('menu-title').value = '';
    document.getElementById('menu-restaurant').value = '';
    document.getElementById('menu-author').value = '';
    document.getElementById('menu-submitter').value = '';
    document.getElementById('menu-desc').value = '';
    showToast('추천 완! >.<');
    renderMenus();
  });

  let tournamentVisited = false;

  function switchTab(tab) {
    document.getElementById('sort-top').classList.toggle('active', tab === 'top');
    document.getElementById('sort-new').classList.toggle('active', tab === 'new');
    document.getElementById('sort-tournament').classList.toggle('active', tab === 'tournament');

    const feedView = document.getElementById('feed-view');
    const tournamentView = document.getElementById('tournament-view');

    if (tab === 'tournament') {
      feedView.classList.add('hidden');
      tournamentView.classList.add('active');
      // Only load leaderboard on first visit — preserve state on subsequent visits
      if (!tournamentVisited) {
        tournamentVisited = true;
        loadTournamentLeaderboard();
      }
    } else {
      feedView.classList.remove('hidden');
      tournamentView.classList.remove('active');
      sort = tab;
      fetchMenus();
    }
  }

  document.getElementById('sort-top').addEventListener('click', () => switchTab('top'));
  document.getElementById('sort-new').addEventListener('click', () => switchTab('new'));
  document.getElementById('sort-tournament').addEventListener('click', () => switchTab('tournament'));

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  fetchMenus().then(()=>{
    setTimeout(()=>{
      const filled = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z";
      function markVoted(ids) {
        ids.forEach(id=>{const btn=document.querySelector('.vote-btn[data-id="'+id+'"]');if(btn){btn.classList.add('active');btn.querySelector('path').setAttribute('d',filled);}});
      }
      fetch(`/api/votes/${encodeURIComponent(getUser())}`).then(r=>r.json()).then(ids=>{
        localStorage.setItem('voted-ids', JSON.stringify(ids));
        markVoted(ids);
      }).catch(e=>{
        markVoted(JSON.parse(localStorage.getItem('voted-ids') || '[]'));
      });
    }, 100);
  });
  setInterval(refreshScores, 30000);

  // Close dropdowns when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('.post-more-wrapper')) {
      document.querySelectorAll('.post-dropdown.show').forEach(d => d.classList.remove('show'));
    }
  });

  let editingId = null;
  let deletingId = null;

  function editPost(menuId) {
    const m = menus.find(x => x.id === menuId);
    if (!m) return;
    document.querySelectorAll('.post-dropdown.show').forEach(d => d.classList.remove('show'));
    editingId = menuId;
    document.getElementById('edit-title').value = m.title || '';
    document.getElementById('edit-restaurant').value = m.restaurant || '';
    document.getElementById('edit-author').value = m.author || '';
    document.getElementById('edit-desc').value = m.description || '';
    document.getElementById('edit-modal').classList.add('show');
  }

  function closeEditModal() { document.getElementById('edit-modal').classList.remove('show'); editingId = null; }

  async function submitEdit() {
    if (!editingId) return;
    const m = menus.find(x => x.id === editingId);
    const res = await fetch(`/api/menus/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: document.getElementById('edit-title').value.trim(),
        restaurant: document.getElementById('edit-restaurant').value.trim(),
        author: document.getElementById('edit-author').value.trim(),
        description: document.getElementById('edit-desc').value.trim(),
        submitted_by: m?.submitted_by || '',
        created_by: getUser()
      })
    });
    if (!res.ok) { const d = await res.json().catch(()=>({})); showToast(d.error || '수정 실패'); return; }
    const updated = await res.json();
    const idx = menus.findIndex(x => x.id === editingId);
    if (idx !== -1) { menus[idx] = { ...menus[idx], ...updated }; }
    renderMenus();
    closeEditModal();
    showToast('수정되었습니다');
  }

  function deletePost(menuId) {
    document.querySelectorAll('.post-dropdown.show').forEach(d => d.classList.remove('show'));
    deletingId = menuId;
    document.getElementById('delete-modal').classList.add('show');
  }

  function closeDeleteModal() { document.getElementById('delete-modal').classList.remove('show'); deletingId = null; }

  async function submitDelete() {
    if (!deletingId) return;
    const res = await fetch(`/api/menus/${deletingId}?user=${encodeURIComponent(getUser())}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json().catch(()=>({})); showToast(d.error || '삭제 실패'); return; }
    menus = menus.filter(m => m.id !== deletingId);
    renderMenus();
    closeDeleteModal();
    showToast('삭제되었습니다');
  }

  // ===== TOURNAMENT =====
  let tournamentState = {
    roundSize: 0,
    bracket: [],
    currentRound: [],
    matchIndex: 0,
    winners: [],
    eliminated: [], // track elimination order for final ranking
  };

  function showTournamentSection(sectionId) {
    ['tournament-leaderboard', 'tournament-game', 'tournament-result', 'tournament-history'].forEach(id => {
      document.getElementById(id).style.display = id === sectionId ? '' : 'none';
    });
  }

  async function loadTournamentLeaderboard() {
    showTournamentSection('tournament-leaderboard');
    const list = document.getElementById('ranking-list');
    let rankings = [];
    try {
      const res = await fetch('/api/tournament/rankings');
      rankings = await res.json();
    } catch(e) { rankings = []; }

    if (!rankings.length) {
      list.innerHTML = '<div class="leaderboard-empty"><div class="icon">🏆</div><p>아직 랭킹 기록이 없습니다.<br>참여해서 원하는 작품을 붐업하세요!</p></div>';
      return;
    }

    // Merge ranking data into menus array for rendering
    rankings.forEach((r, i) => {
      r._medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}위`;
    });

    list.innerHTML = rankings.map((r, i) => {
      // Reuse the same menuCard structure with medal badge
      return `
        <div class="menu-card" id="card-${r.id}">
          <div class="menu-card-body" data-menu-id="${r.id}">
            <div class="post-header">
              <div class="post-header-left">
                <div class="post-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="" width="32" height="32"></div>
                <div class="post-header-info">
                  <div class="post-author-badge">${r.author ? escHtml(r.author) : '익명'}</div>
                  <span class="post-meta-line">${r._medal} · 독서합시다</span>
                </div>
              </div>
              <div class="post-more-wrapper">
                <button class="post-more-btn" aria-label="더보기" type="button" onclick="this.nextElementSibling.classList.toggle('show')"><svg focusable="false" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.125 12a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm-6.25 0a1.875 1.875 0 1 1-3.751 0 1.875 1.875 0 0 1 3.751 0ZM5.75 13.875a1.875 1.875 0 1 1 0-3.75 1.875 1.875 0 0 1 0 3.75Z" fill="currentcolor"></path></svg></button>
                <div class="post-dropdown" ${r.created_by === getUser() ? '' : 'style="display:none"'}>
                  <button onclick="editPost(${r.id})">수정</button>
                  <button onclick="deletePost(${r.id})">삭제</button>
                </div>
              </div>
            </div>
            <div class="post-content">
              ${r.restaurant ? `<h2 class="post-title">${r.submitted_by ? `<a href="${escHtml(r.submitted_by)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${escHtml(r.restaurant)}</a>` : escHtml(r.restaurant)}</h2>` : ''}
              <p class="post-body" style="white-space:pre-wrap">${escHtml(r.title)}</p>
            </div>
            <div class="post-actions">
              <div class="post-actions-left">
                <button class="vote-btn up" data-id="${r.id}" data-val="1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z" fill="currentcolor"/></svg><span id="score-${r.id}">${r.score}</span></button>
                <button class="toggle-comments" data-id="${r.id}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6.832 17.535a1.877 1.877 0 0 1 1.742-.25c1.035.375 2.194.59 3.428.59 4.87 0 8.123-3.145 8.123-6.25s-3.253-6.25-8.123-6.25c-4.87 0-8.122 3.145-8.122 6.25 0 1.25.484 2.453 1.394 3.484.336.38.5.88.46 1.387a6.92 6.92 0 0 1-.44 1.93 9.811 9.811 0 0 0 1.538-.887v-.004Zm-3.999 1.586c.07-.105.137-.21.2-.316.39-.649.76-1.5.835-2.457-1.172-1.332-1.863-2.961-1.863-4.723 0-4.488 4.475-8.125 9.997-8.125C17.526 3.5 22 7.137 22 11.625c0 4.488-4.475 8.125-9.998 8.125-1.448 0-2.823-.25-4.065-.7-.465.34-1.222.805-2.12 1.196a9.564 9.564 0 0 1-1.957.629c-.031.008-.062.012-.094.02-.171.03-.34.058-.515.074-.008 0-.02.004-.027.004-.2.02-.399.03-.598.03a.625.625 0 0 1-.445-1.066 5.606 5.606 0 0 0 .629-.797l.011-.019h.012Z" fill="currentcolor"/></svg>${r.comment_count || 0}</button>
              </div>
              <div class="post-actions-right">
                <button class="post-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 4.875C4.5 3.84 5.34 3 6.375 3v16.242l5.082-3.629a.93.93 0 0 1 1.09 0l5.078 3.63V4.874H6.375V3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762z" fill="currentColor"/></svg></button>
                <button class="post-icon-btn share-btn" data-link="${escHtml(r.submitted_by || '')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12.664 2.275a.934.934 0 0 0-1.324 0l-5.004 5A.937.937 0 0 0 7.66 8.6l3.399-3.398v9.614c0 .519.418.937.937.937.52 0 .938-.418.938-.938V5.202L16.332 8.6a.937.937 0 0 0 1.324-1.324l-4.992-5ZM5.125 15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124a3.438 3.438 0 0 0 3.438 3.438h10.625a3.438 3.438 0 0 0 3.437-3.438V15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124c0 .864-.7 1.563-1.563 1.563H6.688c-.863 0-1.562-.7-1.562-1.563V15.44Z" fill="currentColor"/></svg></button>
              </div>
            </div>
            ${r.description ? `<div class="post-comment-bubble" onclick="toggleComments(${r.id}, this)"><div class="post-comment-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" width="24" height="24" alt=""></div><p class="post-comment-text">${escHtml(r.description)}</p></div>` : ''}
            <div class="comments-section" id="lb-comments-${r.id}">
              <div id="lb-comment-list-${r.id}">Loading…</div>
              <div class="add-comment-form">
                <div class="comment-input-header"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt=""><span>익명</span></div>
                <textarea id="lb-comment-text-${r.id}" placeholder="공감할래말래" rows="1"></textarea>
                <div class="comment-form-row"><button class="btn" onclick="submitComment(${r.id}, this)">등록</button></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach handlers (vote, comments, share) for leaderboard cards
    rankings.forEach(r => {
      const voteBtn = document.querySelector(`#ranking-list .vote-btn[data-id="${r.id}"]`);
      if (voteBtn) voteBtn.addEventListener('click', () => vote(r.id, 1));
      const commentBtn = document.querySelector(`#ranking-list .toggle-comments[data-id="${r.id}"]`);
      if (commentBtn) commentBtn.addEventListener('click', (e) => toggleComments(r.id, e.currentTarget));
      const shareBtn = document.querySelector(`#ranking-list #card-${r.id} .share-btn`);
      if (shareBtn) shareBtn.addEventListener('click', () => {
        const link = shareBtn.getAttribute('data-link');
        if (link) { navigator.clipboard.writeText(link); showToast('링크가 복사되었습니다!'); }
        else { showToast('링크가 없습니다'); }
      });
    });

    // Mark voted hearts
    const voted = JSON.parse(localStorage.getItem('voted-ids') || '[]');
    const filledPath = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z";
    voted.forEach(id => {
      const btn = document.querySelector(`#ranking-list .vote-btn[data-id="${id}"]`);
      if (btn) { btn.classList.add('active'); btn.querySelector('path').setAttribute('d', filledPath); }
    });
  }

  document.getElementById('tournament-play-btn').addEventListener('click', () => {
    if (menus.length < 4) { showToast('최소 4개의 추천이 필요합니다'); return; }
    showTournamentSection('tournament-game');
    document.getElementById('game-title').textContent = '라운드 선택';
    document.getElementById('match-area').innerHTML = '';
    document.getElementById('tournament-back-btn').style.display = 'none';
    renderRoundSelect();
  });

  document.getElementById('game-ranking-btn').addEventListener('click', () => {
    if (tournamentState.matches && tournamentState.matches.length > 0) {
      document.getElementById('leave-game-modal').classList.add('show');
      return;
    }
    showTournamentSection('tournament-leaderboard');
    loadTournamentLeaderboard();
  });

  function closeLeaveGameModal() {
    document.getElementById('leave-game-modal').classList.remove('show');
  }

  function confirmLeaveGame() {
    closeLeaveGameModal();
    showTournamentSection('tournament-leaderboard');
    loadTournamentLeaderboard();
  }

  document.getElementById('tournament-back-btn').addEventListener('click', () => {
    // If game is in progress and has history, undo last pick
    if (tournamentState.history && tournamentState.history.length > 0) {
      const prev = tournamentState.history.pop();
      tournamentState.currentRound = prev.currentRound;
      tournamentState.matchIndex = prev.matchIndex;
      tournamentState.winners = prev.winners;
      tournamentState.eliminated = prev.eliminated;
      renderMatch();
    } else {
      // No history — go back to leaderboard
      showTournamentSection('tournament-leaderboard');
    }
  });

  document.getElementById('tournament-history-btn').addEventListener('click', () => {
    showTournamentSection('tournament-history');
    renderHistory();
  });

  document.getElementById('history-back-btn').addEventListener('click', () => {
    if (menus.length < 8) { showToast('최소 8개의 추천이 필요합니다'); return; }
    showTournamentSection('tournament-game');
    document.getElementById('game-title').textContent = '라운드 선택';
    document.getElementById('match-area').innerHTML = '';
    document.getElementById('tournament-back-btn').style.display = 'none';
    renderRoundSelect();
  });

  document.getElementById('history-ranking-btn').addEventListener('click', () => {
    showTournamentSection('tournament-leaderboard');
    loadTournamentLeaderboard();
  });

  async function renderRoundSelect() {
    const select = document.getElementById('round-select');
    // Refresh menus to get the latest count
    try {
      const res = await fetch('/api/menus');
      menus = await res.json();
    } catch(e) {}
    const available = menus.length;
    if (available < 8) {
      select.innerHTML = '<p style="color:var(--muted);font-size:14px;">추천이 부족합니다 (최소 8개)</p>';
      return;
    }
    const fixedSizes = [8, 16, 32].filter(s => s <= available);
    let buttons = fixedSizes.map(s => `<button onclick="startTournament(${s})">${s}강</button>`).join('');
    buttons += `<button onclick="startTournament(${available})">${available}강</button>`;
    select.innerHTML = buttons;
  }

  function startTournament(size) {
    const shuffled = [...menus].sort(() => Math.random() - 0.5).slice(0, size);
    // Calculate byes: next power of 2 minus actual count
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
    const byeCount = nextPow2 - shuffled.length;
    // First `byeCount` entries get a bye (auto-advance to round 2)
    const byes = shuffled.slice(0, byeCount);
    const firstRound = shuffled.slice(byeCount);

    tournamentState = {
      roundSize: size,
      bracket: shuffled,
      currentRound: firstRound,
      matchIndex: 0,
      winners: [...byes], // byes auto-advance
      eliminated: [],
      history: [],
      matches: [],
    };
    document.getElementById('round-select').innerHTML = '';
    document.getElementById('tournament-back-btn').style.display = '';
    renderMatch();
  }

  function getRoundLabel(count) {
    if (count === 2) return '결승';
    if (count === 4) return '준결승';
    return `${count}강`;
  }

  function matchCardHtml(m, side) {
    return `
      <div class="match-card" id="match-${side}">
        <div class="menu-card-body" data-menu-id="${m.id}">
          <div class="post-header">
            <div class="post-header-left">
              <div class="post-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="" width="32" height="32"></div>
              <div class="post-header-info">
                <div class="post-author-badge">${m.author ? escHtml(m.author) : '익명'}</div>
                <span class="post-meta-line">${relativeTime(m.created_at)} · 독서합시다</span>
              </div>
            </div>
          </div>
          <div class="post-content">
            ${m.restaurant ? `<h2 class="post-title">${escHtml(m.restaurant)}</h2>` : ''}
            <p class="post-body" style="white-space:pre-wrap">${escHtml(m.title)}</p>
          </div>
          <div class="post-actions">
            <div class="post-actions-left">
              <span class="vote-btn up"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z" fill="currentcolor"/></svg><span>${m.score || 0}</span></span>
              <button class="toggle-comments" data-side="${side}" onclick="event.stopPropagation();toggleComments(${m.id}, this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6.832 17.535a1.877 1.877 0 0 1 1.742-.25c1.035.375 2.194.59 3.428.59 4.87 0 8.123-3.145 8.123-6.25s-3.253-6.25-8.123-6.25c-4.87 0-8.122 3.145-8.122 6.25 0 1.25.484 2.453 1.394 3.484.336.38.5.88.46 1.387a6.92 6.92 0 0 1-.44 1.93 9.811 9.811 0 0 0 1.538-.887v-.004Zm-3.999 1.586c.07-.105.137-.21.2-.316.39-.649.76-1.5.835-2.457-1.172-1.332-1.863-2.961-1.863-4.723 0-4.488 4.475-8.125 9.997-8.125C17.526 3.5 22 7.137 22 11.625c0 4.488-4.475 8.125-9.998 8.125-1.448 0-2.823-.25-4.065-.7-.465.34-1.222.805-2.12 1.196a9.564 9.564 0 0 1-1.957.629c-.031.008-.062.012-.094.02-.171.03-.34.058-.515.074-.008 0-.02.004-.027.004-.2.02-.399.03-.598.03a.625.625 0 0 1-.445-1.066 5.606 5.606 0 0 0 .629-.797l.011-.019h.012Z" fill="currentcolor"/></svg>${m.comment_count || 0}</button>
            </div>
            <div class="post-actions-right">
              <span class="post-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 4.875C4.5 3.84 5.34 3 6.375 3v16.242l5.082-3.629a.93.93 0 0 1 1.09 0l5.078 3.63V4.874H6.375V3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762z" fill="currentColor"/></svg></span>
              <span class="post-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12.664 2.275a.934.934 0 0 0-1.324 0l-5.004 5A.937.937 0 0 0 7.66 8.6l3.399-3.398v9.614c0 .519.418.937.937.937.52 0 .938-.418.938-.938V5.202L16.332 8.6a.937.937 0 0 0 1.324-1.324l-4.992-5ZM5.125 15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124a3.438 3.438 0 0 0 3.438 3.438h10.625a3.438 3.438 0 0 0 3.437-3.438V15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124c0 .864-.7 1.563-1.563 1.563H6.688c-.863 0-1.562-.7-1.562-1.563V15.44Z" fill="currentColor"/></svg></span>
            </div>
          </div>
          ${m.description ? `<div class="post-comment-bubble" onclick="event.stopPropagation();toggleComments(${m.id}, this)"><div class="post-comment-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" width="24" height="24" alt=""></div><p class="post-comment-text">${escHtml(m.description)}</p></div>` : ''}
          <div class="comments-section" id="match-comments-${side}">
            <div id="match-comment-list-${side}"></div>
            <div class="add-comment-form">
              <div class="comment-input-header"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt=""><span>익명</span></div>
              <textarea id="match-comment-text-${side}" placeholder="댓글을 남겨보세요" rows="1" onclick="event.stopPropagation()"></textarea>
              <div class="comment-form-row"><button class="btn" onclick="event.stopPropagation();submitComment(${m.id}, this)">등록</button></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMatch() {
    const { currentRound, matchIndex, winners } = tournamentState;
    const totalMatches = currentRound.length / 2;

    if (matchIndex >= totalMatches) {
      if (winners.length === 1) {
        finishTournament(winners[0]);
        return;
      }
      tournamentState.currentRound = winners;
      tournamentState.winners = [];
      tournamentState.matchIndex = 0;
      renderMatch();
      return;
    }

    const a = currentRound[matchIndex * 2];
    const b = currentRound[matchIndex * 2 + 1];
    // Total participants this round = playing + already advanced (byes or previous winners)
    const roundTotal = currentRound.length + tournamentState.winners.length;
    const roundLabel = getRoundLabel(roundTotal);
    const matchNum = matchIndex + 1;

    document.getElementById('game-title').textContent = `${roundLabel} ${matchNum}/${totalMatches}`;

    document.getElementById('match-area').innerHTML = `
      <div class="match-container">
        ${matchCardHtml(a, 'a')}
        <div class="match-vs">VS</div>
        ${matchCardHtml(b, 'b')}
      </div>
    `;

    document.getElementById('match-a').addEventListener('click', () => pickWinner(a, b));
    document.getElementById('match-b').addEventListener('click', () => pickWinner(b, a));
  }

  async function loadMatchComments(menuId, targetElId) {
    const el = document.getElementById(targetElId);
    try {
      const res = await fetch(`/api/menus/${menuId}/comments`);
      const comments = await res.json();
      if (!comments.length) {
        el.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:8px 0;">아직 댓글이 없습니다</p>';
        return;
      }
      el.innerHTML = comments.map(c => `
        <div class="comment-item">
          <img class="comment-avatar" src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="">
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-nickname">익명</span>
              <span class="comment-time">${relativeTime(c.created_at)}</span>
            </div>
            <div class="comment-text">${escHtml(c.content)}</div>
            ${c.preferences ? `<span class="comment-pref">🥗 ${escHtml(c.preferences)}</span>` : ''}
          </div>
        </div>
      `).join('');
    } catch(e) {
      el.innerHTML = '<p style="font-size:13px;color:var(--muted);padding:8px 0;">댓글을 불러올 수 없습니다</p>';
    }
  }

  async function pickWinner(winner, loser) {
    // Save current state for undo
    tournamentState.history = tournamentState.history || [];
    tournamentState.history.push({
      currentRound: [...tournamentState.currentRound],
      matchIndex: tournamentState.matchIndex,
      winners: [...tournamentState.winners],
      eliminated: [...tournamentState.eliminated],
      matches: [...(tournamentState.matches || [])],
    });

    tournamentState.winners.push(winner);
    tournamentState.eliminated.push(loser);
    tournamentState.matchIndex++;

    // Store match locally — will be submitted when tournament finishes
    tournamentState.matches = tournamentState.matches || [];
    tournamentState.matches.push({ winner_id: winner.id, loser_id: loser.id });

    renderMatch();
  }

  function finishTournament(winner) {
    // Build final ranking: winner first, then eliminated in reverse order
    const ranking = [winner, ...tournamentState.eliminated.reverse()];

    // Batch submit all matches to server in one request
    const player = getUser();
    const roundSize = tournamentState.roundSize;
    if (tournamentState.matches && tournamentState.matches.length > 0) {
      fetch('/api/tournament/matches/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matches: tournamentState.matches, player, round_size: roundSize })
      }).catch(() => {});
    }

    // Save to localStorage
    const history = JSON.parse(localStorage.getItem('tournament-history') || '[]');
    history.unshift({
      date: new Date().toISOString(),
      roundSize: tournamentState.roundSize,
      ranking: ranking.map(m => ({ id: m.id, title: m.title, restaurant: m.restaurant, author: m.author })),
    });
    // Keep last 20
    if (history.length > 20) history.length = 20;
    localStorage.setItem('tournament-history', JSON.stringify(history));

    // Show result
    showTournamentSection('tournament-result');
    document.getElementById('tournament-result').innerHTML = `
      <div class="tournament-result">
        <div class="menu-card" id="result-winner-card">
          <div class="menu-card-body" data-menu-id="${winner.id}">
            <div class="post-header">
              <div class="post-header-left">
                <div class="post-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt="" width="32" height="32"></div>
                <div class="post-header-info">
                  <div class="post-author-badge">${winner.author ? escHtml(winner.author) : '익명'}</div>
                  <span class="post-meta-line">🥇 · 독서합시다</span>
                </div>
              </div>
            </div>
            <div class="post-content">
              ${winner.restaurant ? `<h2 class="post-title">${escHtml(winner.restaurant)}</h2>` : ''}
              <p class="post-body" style="white-space:pre-wrap">${escHtml(winner.title)}</p>
            </div>
            <div class="post-actions">
              <div class="post-actions-left">
                <button class="vote-btn up" data-id="${winner.id}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Zm.52-12.625a.205.205 0 0 1-.04-.043l-.695-.78-.003-.005A3.85 3.85 0 0 0 3.875 9.23v.13c0 1.113.465 2.18 1.281 2.937L12 18.651l6.844-6.355a4.012 4.012 0 0 0 1.281-2.937v-.13a3.851 3.851 0 0 0-6.723-2.566l-.004.004-.003.004-.696.781c-.011.016-.027.028-.039.043a.935.935 0 0 1-1.32 0v-.004Z" fill="currentcolor"/></svg><span id="rscore-${winner.id}">${winner.score || 0}</span></button>
                <button class="toggle-comments" data-id="${winner.id}" onclick="toggleComments(${winner.id}, this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6.832 17.535a1.877 1.877 0 0 1 1.742-.25c1.035.375 2.194.59 3.428.59 4.87 0 8.123-3.145 8.123-6.25s-3.253-6.25-8.123-6.25c-4.87 0-8.122 3.145-8.122 6.25 0 1.25.484 2.453 1.394 3.484.336.38.5.88.46 1.387a6.92 6.92 0 0 1-.44 1.93 9.811 9.811 0 0 0 1.538-.887v-.004Zm-3.999 1.586c.07-.105.137-.21.2-.316.39-.649.76-1.5.835-2.457-1.172-1.332-1.863-2.961-1.863-4.723 0-4.488 4.475-8.125 9.997-8.125C17.526 3.5 22 7.137 22 11.625c0 4.488-4.475 8.125-9.998 8.125-1.448 0-2.823-.25-4.065-.7-.465.34-1.222.805-2.12 1.196a9.564 9.564 0 0 1-1.957.629c-.031.008-.062.012-.094.02-.171.03-.34.058-.515.074-.008 0-.02.004-.027.004-.2.02-.399.03-.598.03a.625.625 0 0 1-.445-1.066 5.606 5.606 0 0 0 .629-.797l.011-.019h.012Z" fill="currentcolor"/></svg>${winner.comment_count || 0}</button>
              </div>
              <div class="post-actions-right">
                <button class="post-icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4.5 4.875C4.5 3.84 5.34 3 6.375 3v16.242l5.082-3.629a.93.93 0 0 1 1.09 0l5.078 3.63V4.874H6.375V3h11.25c1.035 0 1.875.84 1.875 1.875v16.188a.938.938 0 0 1-1.48.762L12 17.526l-6.02 4.297a.938.938 0 0 1-1.48-.762z" fill="currentColor"/></svg></button>
                <button class="post-icon-btn share-btn" data-link="${escHtml(winner.submitted_by || '')}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12.664 2.275a.934.934 0 0 0-1.324 0l-5.004 5A.937.937 0 0 0 7.66 8.6l3.399-3.398v9.614c0 .519.418.937.937.937.52 0 .938-.418.938-.938V5.202L16.332 8.6a.937.937 0 0 0 1.324-1.324l-4.992-5ZM5.125 15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124a3.438 3.438 0 0 0 3.438 3.438h10.625a3.438 3.438 0 0 0 3.437-3.438V15.44a.935.935 0 0 0-.938-.938.935.935 0 0 0-.937.938v3.124c0 .864-.7 1.563-1.563 1.563H6.688c-.863 0-1.562-.7-1.562-1.563V15.44Z" fill="currentColor"/></svg></button>
              </div>
            </div>
            ${winner.description ? `<div class="post-comment-bubble" onclick="toggleComments(${winner.id}, this)"><div class="post-comment-avatar"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" width="24" height="24" alt=""></div><p class="post-comment-text">${escHtml(winner.description)}</p></div>` : ''}
            <div class="comments-section" id="rw-comments-${winner.id}">
              <div id="rw-comment-list-${winner.id}"></div>
              <div class="add-comment-form">
                <div class="comment-input-header"><img src="https://d33pksfia2a94m.cloudfront.net/assets/img/avatar/avatar_blank.png" alt=""><span>익명</span></div>
                <textarea id="rw-comment-text-${winner.id}" placeholder="공감할래말래" rows="1"></textarea>
                <div class="comment-form-row"><button class="btn" onclick="submitComment(${winner.id}, this)">등록</button></div>
              </div>
            </div>
          </div>
        </div>

        <div class="result-ranking">
          ${ranking.slice(1).map((m, i) => {
            const idx = i + 1;
            const medal = idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx+1);
            return `
              <div class="result-ranking-item">
                <div class="result-rank">${medal}</div>
                <div class="result-ranking-info">
                  <div class="result-ranking-title">${m.restaurant ? escHtml(m.restaurant) : ''}${m.author ? ` <span style="font-weight:400;color:var(--muted);font-size:12px;">· ${escHtml(m.author)}</span>` : ''}</div>
                  <div class="post-body" style="font-size:14px;margin-top:2px;white-space:pre-wrap;">${escHtml(m.title)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="result-actions">
          <button class="tournament-btn" style="background:transparent;color:var(--text);border:1px solid var(--border);" onclick="showTournamentSection('tournament-leaderboard');loadTournamentLeaderboard();">랭킹 보기</button>
          <button class="tournament-btn" onclick="showTournamentSection('tournament-game');document.getElementById('game-title').textContent='라운드 선택';document.getElementById('match-area').innerHTML='';document.getElementById('tournament-back-btn').style.display='none';renderRoundSelect();">다시하기</button>
        </div>
      </div>
    `;

    // Attach handlers for result page cards
    const resultEl = document.getElementById('tournament-result');
    const winnerVoteBtn = resultEl.querySelector(`#result-winner-card .vote-btn[data-id="${winner.id}"]`);
    if (winnerVoteBtn) winnerVoteBtn.addEventListener('click', () => vote(winner.id, 1));
    const winnerShareBtn = resultEl.querySelector('#result-winner-card .share-btn');
    if (winnerShareBtn) winnerShareBtn.addEventListener('click', () => {
      const link = winnerShareBtn.getAttribute('data-link');
      if (link) { navigator.clipboard.writeText(link); showToast('링크가 복사되었습니다!'); }
      else { showToast('링크가 없습니다'); }
    });
    resultEl.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const link = btn.getAttribute('data-link');
        if (link) { navigator.clipboard.writeText(link); showToast('링크가 복사되었습니다!'); }
        else { showToast('링크가 없습니다'); }
      });
    });
    // Mark voted hearts
    const voted = JSON.parse(localStorage.getItem('voted-ids') || '[]');
    const filledPath = "m10.82 20.116-.097-.09-6.844-6.355A5.882 5.882 0 0 1 2 9.359v-.13C2 6.48 3.953 4.12 6.656 3.606A5.71 5.71 0 0 1 12 5.417a5.562 5.562 0 0 1 .977-.871 5.73 5.73 0 0 1 4.367-.945A5.73 5.73 0 0 1 22 9.23v.129c0 1.636-.68 3.199-1.879 4.312l-6.844 6.355-.097.09c-.32.297-.742.465-1.18.465a1.72 1.72 0 0 1-1.18-.465Z";
    voted.forEach(id => {
      resultEl.querySelectorAll(`.vote-btn[data-id="${id}"]`).forEach(btn => {
        btn.classList.add('active');
        btn.querySelector('path').setAttribute('d', filledPath);
      });
    });
  }

  function renderHistory() {
    const history = JSON.parse(localStorage.getItem('tournament-history') || '[]');
    const list = document.getElementById('history-list');

    if (!history.length) {
      list.innerHTML = '<div class="leaderboard-empty"><div class="icon">📋</div><p>아직 기록이 없습니다.<br>월드컵에 참여해보세요!</p></div>';
      return;
    }

    // Find most frequent winner(s) including ties — use ID to distinguish same-title cards
    const winCounts = {};
    const winMenus = {};
    history.forEach(h => {
      const w = h.ranking[0];
      const key = w.id;
      winCounts[key] = (winCounts[key] || 0) + 1;
      if (!winMenus[key]) winMenus[key] = w;
    });
    const sorted = Object.entries(winCounts).sort((a, b) => b[1] - a[1]);
    const topCount = sorted.length ? sorted[0][1] : 0;
    const topEntries = sorted.filter(([_, count]) => count === topCount);

    list.innerHTML = `
      ${topEntries.length ? `
        <div style="padding:12px 0 0;font-size:14px;color:var(--muted);cursor:pointer;" onclick="document.getElementById('top-winner-detail').style.display = document.getElementById('top-winner-detail').style.display === 'none' ? 'block' : 'none'">
          내 최다 우승: ${topEntries.map(([id]) => `<strong style="color:var(--text);">${escHtml(winMenus[id].restaurant || winMenus[id].title.slice(0, 20))}</strong>`).join(', ')} (${topCount}회) <span style="font-size:12px;">▼</span>
        </div>
        <div id="top-winner-detail" style="display:none;">
          ${topEntries.map(([id]) => {
            const m = winMenus[id];
            return `<div class="result-ranking-item">
              <div class="result-rank">🏆</div>
              <div class="result-ranking-info">
                <div class="result-ranking-title">${m.restaurant ? escHtml(m.restaurant) : ''}${m.author ? ` <span style="font-weight:400;color:var(--muted);font-size:12px;">· ${escHtml(m.author)}</span>` : ''}</div>
                <div class="post-body" style="font-size:14px;margin-top:2px;white-space:pre-wrap;">${escHtml(m.title)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : ''}
      <div class="history-section">
        ${history.map((h, idx) => {
          const w = h.ranking[0];
          const d = new Date(h.date);
          const dateStr = `${d.getMonth()+1}/${d.getDate()}`;
          return `
            <div class="history-item" onclick="toggleHistoryDetail(${idx})" style="cursor:pointer;">
              <span class="history-date">${dateStr}</span>
              <span class="history-round">${h.roundSize}강</span>
              <span class="history-winner">🏆 ${w.restaurant ? escHtml(w.restaurant) : escHtml(w.title.slice(0, 25))}</span>
              <span style="color:var(--muted);font-size:12px;">▼</span>
            </div>
            <div class="history-detail" id="history-detail-${idx}" style="display:none;padding:8px 0 16px;border-bottom:1px solid var(--border);">
              ${h.ranking.map((m, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i+1);
                return `<div class="result-ranking-item">
                  <div class="result-rank">${medal}</div>
                  <div class="result-ranking-info">
                    <div class="result-ranking-title">${m.restaurant ? escHtml(m.restaurant) : ''}${m.author ? ` <span style="font-weight:400;color:var(--muted);font-size:13px;">· ${escHtml(m.author)}</span>` : ''}</div>
                    <div class="post-body" style="font-size:14px;margin-top:2px;white-space:pre-wrap;">${escHtml(m.title)}</div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function toggleHistoryDetail(idx) {
    const el = document.getElementById(`history-detail-${idx}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
