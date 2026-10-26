/* =====================================================
   โหมดเดโม (เปิดไฟล์ตรงๆ file:// หรือเปิดบน GitHub Pages): จำลอง backend ในเบราว์เซอร์ เก็บข้อมูลใน localStorage ของแต่ละเครื่อง
   เมื่อรันผ่านเซิร์ฟเวอร์ (npm start) โค้ดส่วนนี้จะไม่ทำงาน และใช้ฐานข้อมูลจริงของ backend/
===================================================== */
if (location.protocol === "file:" || /\.github\.io$/.test(location.hostname)) (() => {
  const mk = (id, name, category, location, total, stock) => ({ id, name, category, location, image: "", total, stock, damaged: 0, highValue: false });
  const db = {
    users: [
      { id: "EMP-8042", employeeId: "EMP-8042", username: "user", password: "1234", name: "สมชาย เข็มกลัด", role: "user", department: "ฝ่ายช่าง" },
      { id: "ADMIN-001", employeeId: "ADMIN-001", username: "admin", password: "admin123", name: "เจ้าหน้าที่คลัง", role: "admin", department: "ผู้ดูแลระบบ" }],
    equipment: [mk("EQ-001", "สว่านกระแทกไร้สาย Makita", "สว่าน", "ชั้นวาง A", 5, 3), mk("EQ-002", "ตะไบเหล็กแบน 10 นิ้ว", "ตะไบ", "ตู้ B", 5, 5),
      mk("EQ-003", "ไม้ฉากเหล็กวัดมุม 12 นิ้ว", "ไม้ฉาก", "ชั้นวาง C", 2, 0), mk("EQ-004", "เวอร์เนียร์คาลิปเปอร์ ดิจิทัล", "เวอร์เนีย", "ตู้ B", 3, 2)],
    transactions: [] };
  const KEY = "toolflow-standalone-db";
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.users && s.equipment && s.transactions) Object.assign(db, s); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  const sessions = {}, uid = () => Math.random().toString(36).slice(2, 10);
  const pub = ({ password, ...r }) => r, bad = (s, e) => [s, { error: e }], ok = (d, s = 200) => [s, d];
  const eqOf = id => db.equipment.find(e => e.id === id), txOf = id => db.transactions.find(t => t.id === id);
  const restock = t => { const e = eqOf(t.equipmentId); if (e) e.stock = Math.min(e.total - e.damaged, e.stock + t.quantity); };

  function handle(m, u, b, tok) {
    const url = new URL(u, "http://x"), p = url.pathname, q = url.searchParams;
    if (m === "POST" && p === "/api/login") {
      const x = db.users.find(v => v.username === b.username && v.password === b.password);
      if (!x) return bad(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      const t = uid() + uid(); sessions[t] = x.id; return ok({ token: t, user: pub(x) });
    }
    const user = db.users.find(x => x.id === sessions[tok]);
    if (!user) return bad(401, "กรุณาเข้าสู่ระบบ");
    const admin = user.role === "admin", deny = bad(403, "เฉพาะเจ้าหน้าที่");
    let r;
    if (m === "POST" && p === "/api/logout") { delete sessions[tok]; return ok({ ok: true }); }
    if (m === "GET" && p === "/api/equipment") {
      const s = (q.get("q") || "").toLowerCase();
      return ok(db.equipment.filter(e => (!q.get("category") || e.category === q.get("category")) && (!s || (e.id + e.name + e.location).toLowerCase().includes(s))));
    }
    if ((r = p.match(/^\/api\/equipment\/([^/]+)$/))) {
      const id = decodeURIComponent(r[1]), e = eqOf(id);
      if (m === "GET") return e ? ok(e) : bad(404, "ไม่พบอุปกรณ์");
      if (!admin) return deny; if (!e) return bad(404, "ไม่พบอุปกรณ์");
      if (m === "DELETE") { db.equipment = db.equipment.filter(x => x !== e); return ok({ ok: true }); }
      if (m === "PUT") { Object.assign(e, { name: b.name, category: b.category, location: b.location, image: b.image || "", total: +b.total, stock: +b.stock }); return ok(e); }
    }
    if (m === "POST" && p === "/api/equipment") {
      if (!admin) return deny;
      if (!b.id || !b.name || !b.category || !b.location) return bad(400, "กรอกข้อมูลให้ครบ");
      if (eqOf(b.id)) return bad(409, "รหัสอุปกรณ์นี้มีอยู่แล้ว");
      if (!(+b.total >= 0) || !(+b.stock >= 0) || +b.stock > +b.total) return bad(400, "จำนวนอุปกรณ์ไม่ถูกต้อง");
      const e = { ...mk(b.id, b.name, b.category, b.location, +b.total, +b.stock), image: b.image || "" }; db.equipment.push(e); return ok(e, 201);
    }
    if (p === "/api/users" && m === "GET") return admin ? ok(db.users.map(pub)) : deny;
    if (p === "/api/users" && m === "POST") {
      if (!admin) return deny;
      if (!b.employeeId || !b.username || !b.name || !b.password) return bad(400, "กรอกข้อมูลให้ครบ");
      if (db.users.some(x => x.id === b.employeeId || x.username === b.username)) return bad(409, "ชื่อผู้ใช้หรือรหัสซ้ำ");
      const x = { id: b.employeeId, employeeId: b.employeeId, username: b.username, password: b.password, name: b.name, role: b.role === "admin" ? "admin" : "user", department: b.department || "-" };
      db.users.push(x); return ok(pub(x), 201);
    }
    if ((r = p.match(/^\/api\/users\/([^/]+)(\/password)?$/))) {
      if (!admin) return deny; const id = decodeURIComponent(r[1]), x = db.users.find(v => v.id === id);
      if (!x) return bad(404, "ไม่พบผู้ใช้");
      if (m === "PUT" && r[2]) { if (String(b.password || "").length < 4) return bad(400, "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"); x.password = b.password; return ok({ ok: true }); }
      if (m === "DELETE") { if (x.id === user.id) return bad(400, "ลบบัญชีที่ใช้งานอยู่ไม่ได้"); db.users = db.users.filter(v => v !== x); return ok({ ok: true }); }
    }
    if (m === "POST" && p === "/api/borrow") {
      const e = eqOf(b.equipmentId); if (!e) return bad(404, "ไม่พบอุปกรณ์");
      const n = +b.quantity;
      if (!Number.isInteger(n) || n < 1) return bad(400, "จำนวนไม่ถูกต้อง");
      if (n > e.stock) return bad(400, `เบิกเกินจำนวนคงเหลือ (เหลือ ${e.stock})`);
      if (!b.dueDate) return bad(400, "ระบุกำหนดคืน");
      e.stock -= n;
      const t = { id: uid(), userId: user.id, userName: user.name, equipmentId: e.id, equipmentName: e.name, quantity: n, status: "pending", borrowedAt: new Date().toISOString(), dueDate: b.dueDate, returnedAt: null };
      db.transactions.unshift(t); return ok(t, 201);
    }
    if (m === "GET" && p === "/api/transactions") return ok(db.transactions.filter(t => admin || t.userId === user.id));
    if ((r = p.match(/^\/api\/transactions\/([^/]+)\/(approve|reject|return|damaged)$/)) && m === "POST") {
      if (!admin) return deny; const t = txOf(r[1]); if (!t) return bad(404, "ไม่พบรายการ");
      if (r[2] === "approve" || r[2] === "reject") {
        if (t.status !== "pending") return bad(400, "รายการนี้ไม่ได้รอการยืนยัน");
        if (r[2] === "approve") t.status = "borrowed"; else { t.status = "rejected"; restock(t); }
      } else {
        if (t.status !== "borrowed") return bad(400, "รายการนี้ยังไม่ได้ยืนยันการยืม หรือคืนแล้ว");
        t.returnedAt = new Date().toISOString();
        if (r[2] === "return") { t.status = "returned"; restock(t); } else { t.status = "damaged"; eqOf(t.equipmentId).damaged += t.quantity; }
      }
      return ok(t);
    }
    return bad(404, "ไม่พบ API นี้");
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (url, opt = {}) => {
    if (!String(url).startsWith("/api/")) return realFetch(url, opt);
    const tok = ((opt.headers || {}).Authorization || "").replace("Bearer ", "");
    const [status, data] = handle((opt.method || "GET").toUpperCase(), String(url), opt.body ? JSON.parse(opt.body) : {}, tok);
    save();
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  };
})();

/* =====================================================
   TOOLHUB APP
===================================================== */


/* =====================================================
   STATE
===================================================== */

let currentUser = null;

let selectedRole = "user";

let currentView = "login";

let historyStack = [];

let activeCategory = "ทั้งหมด";

let editingEquipmentId = null;

let qrScanner = null;

let isScannerRunning = false;

let scannedUser = null;

let transactionType = "borrow";


/* =====================================================
   MOCK USERS
===================================================== */

const users = [];


/* =====================================================
   EQUIPMENT
===================================================== */

let equipment = [];


/* =====================================================
   LOGS
===================================================== */

let logs = [];


/* =====================================================
   HELPER
===================================================== */

function $(id) {

  return document.getElementById(id);

}


function escapeHTML(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  const toast = $("toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {

    toast.classList.remove("show");

  }, 2500);

}


/* =====================================================
   LOGIN ROLE
===================================================== */

function selectRole(role) {

  selectedRole = role;

  const userButton = $("role-user");
  const adminButton = $("role-admin");

  if (userButton) {
    userButton.classList.toggle(
      "active",
      role === "user"
    );
  }

  if (adminButton) {
    adminButton.classList.toggle(
      "active",
      role === "admin"
    );
  }

}


/* =====================================================
   LOGIN
===================================================== */

function handleLogin(event) {

  event.preventDefault();

  const username =
    $("username").value.trim();

  const password =
    $("password").value;

  const user = users.find(item =>

    item.username === username &&
    item.password === password &&
    item.role === selectedRole

  );


  if (!user) {

    showToast(
      "ชื่อผู้ใช้ รหัสผ่าน หรือประเภทผู้ใช้งานไม่ถูกต้อง"
    );

    return;

  }


  currentUser = user;

  historyStack = [];

  if (user.role === "admin") {

    switchView("admin-dashboard");

  } else {

    switchView("user-dashboard");

  }

  showToast(
    `ยินดีต้อนรับ ${user.name}`
  );

}


/* =====================================================
   LOGOUT
===================================================== */

function handleLogout() {

  stopQRScanner();

  currentUser = null;

  historyStack = [];

  switchView("login");

  const form = $("login-form");

  if (form) {
    form.reset();
  }

  selectRole("user");

  showToast("ออกจากระบบแล้ว");

}


/* =====================================================
   NAVIGATION
===================================================== */

function switchView(viewId, addHistory = true) {

  const current = currentView;

  if (
    addHistory &&
    current !== viewId &&
    current !== "login"
  ) {

    historyStack.push(current);

  }


  document
    .querySelectorAll(".view")
    .forEach(view => {

      view.classList.remove("active");

    });


  const target = $(viewId);

  if (!target) {
    return;
  }


  target.classList.add("active");

  currentView = viewId;

  updateHeader();

  updateBottomNavigation();


  if (viewId === "user-dashboard") {

    renderUserDashboard();

  }


  if (viewId === "user-history") {

    renderUserHistory();

  }


  if (viewId === "admin-dashboard") {

    renderAdminDashboard();

  }


  if (viewId === "qr-scanner") {

    updateHeader();

  }

}


function goBack() {

  if (currentView === "qr-scanner") {

    closeQRScanner();

    return;

  }


  if (historyStack.length > 0) {

    const previous =
      historyStack.pop();

    switchView(previous, false);

    return;

  }


  if (currentUser) {

    if (currentUser.role === "admin") {

      switchView(
        "admin-dashboard",
        false
      );

    } else {

      switchView(
        "user-dashboard",
        false
      );

    }

  } else {

    switchView(
      "login",
      false
    );

  }

}


/* =====================================================
   HEADER
===================================================== */

function updateHeader() {

  const title = $("page-title");

  const back = $("back-button");

  const logout = $("logout-button");


  const titles = {

    login: "ToolFlow",

    "user-dashboard": "หน้าหลัก",

    "user-history": "ประวัติการยืมคืน",

    "admin-dashboard": "ผู้ดูแลระบบ",

    "qr-scanner": "สแกน QR Code"

  };


  if (title) {

    title.textContent =
      titles[currentView] ||
      "ToolFlow";

  }


  if (back) {

    back.style.display =
      currentView !== "login"
        ? "block"
        : "none";

  }


  if (logout) {

    logout.style.display =
      currentView !== "login"
        ? "block"
        : "none";

  }

}


function updateBottomNavigation() {
  // Reserved for future mobile bottom navigation
}


/* =====================================================
   USER DASHBOARD
===================================================== */

function renderUserDashboard() {

  if (!currentUser) {
    return;
  }


  $("user-welcome-name").textContent =
    currentUser.name;

  $("user-welcome-department").textContent =
    currentUser.department;


  $("user-name").textContent =
    currentUser.name;

  $("user-employee-id").textContent =
    currentUser.employeeId;

  $("user-department").textContent =
    currentUser.department;




  const currentBorrows =
    logs.filter(log =>

      log.employeeId ===
        currentUser.employeeId &&

      log.action === "ยืม" &&

      !log.returnDate

    );


  const container =
    $("current-borrow-list");


  if (!currentBorrows.length) {

    container.innerHTML = `

      <div class="empty-state">

        <div class="empty-state-icon">
          
        </div>

        <div>
          ไม่มีรายการอุปกรณ์ที่อยู่ระหว่างการยืม
        </div>

      </div>

    `;

    return;

  }


  container.innerHTML =
    currentBorrows.map(log => `

      <div class="borrow-item">

        <div class="item-header">

          <div>

            <div class="item-name">
              ${escapeHTML(log.equipmentName)}
            </div>

            <div class="item-code">
              ${escapeHTML(log.equipmentId)}
            </div>

          </div>

          <span class="history-status borrowed">
            กำลังยืม
          </span>

        </div>


        <div class="item-details">

          <div class="item-detail">

            <span>
              วันที่ยืม
            </span>

            <strong>
              ${escapeHTML(log.borrowDate)}
            </strong>

          </div>


          <div class="item-detail">

            <span>
              กำหนดคืน
            </span>

            <strong>
              ${escapeHTML(log.dueDate)}
            </strong>

          </div>

        </div>

      </div>

    `).join("");

}


/* =====================================================
   USER HISTORY
===================================================== */

function renderUserHistory() {

  if (!currentUser) {
    return;
  }


  const userLogs =
    logs.filter(log =>

      log.employeeId ===
      currentUser.employeeId

    );


  const container =
    $("user-history-list");


  if (!userLogs.length) {

    container.innerHTML = `

      <div class="card">

        <div class="empty-state">

          <div class="empty-state-icon">
            
          </div>

          ยังไม่มีประวัติ

        </div>

      </div>

    `;

    return;

  }


  container.innerHTML =
    userLogs.map(log => {

      const isDamaged =
        log.action === "ชำรุด";

      const returned =
        !!log.returnDate;


      const statusClass =
        isDamaged
          ? "damaged"
          : returned
            ? "returned"
            : "borrowed";


      const statusText =
        isDamaged
          ? "ชำรุด"
          : returned
            ? "คืนแล้ว"
            : log.approval === "pending" ? "รอการยืนยันจากเจ้าหน้าที่" : "กำลังยืม";


      return `

        <div class="history-item">

          <div class="item-header">

            <div>

              <div class="item-name">
                ${escapeHTML(log.equipmentName)}
              </div>

              <div class="item-code">
                ${escapeHTML(log.equipmentId)}
              </div>

            </div>

            <span
              class="history-status ${statusClass}"
            >
              ${statusText}
            </span>

          </div>


          <div class="item-details">

            <div class="item-detail">

              <span>
                วันที่ยืม
              </span>

              <strong>
                ${escapeHTML(log.borrowDate)}
              </strong>

            </div>


            <div class="item-detail">

              <span>
                กำหนดคืน
              </span>

              <strong>
                ${escapeHTML(log.dueDate)}
              </strong>

            </div>


            ${
              returned
                ? `

                  <div class="item-detail">

                    <span>
                      วันที่คืน
                    </span>

                    <strong>
                      ${escapeHTML(log.returnDate)}
                    </strong>

                  </div>

                `
                : ""
            }

          </div>

        </div>

      `;

    }).join("");

}


/* =====================================================
   ADMIN DASHBOARD
===================================================== */

function renderAdminDashboard() {

  const totalEquipment =
    equipment.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );


  const available =
    equipment.reduce(
      (sum, item) =>
        sum + item.stock,
      0
    );


  const damagedTotal =
    equipment.reduce(
      (sum, item) =>
        sum + (item.damaged || 0),
      0
    );


  const borrowed =
    totalEquipment -
    available -
    damagedTotal;


  $("stat-total-equipment")
    .textContent =
    totalEquipment;


  $("stat-available")
    .textContent =
    available;


  $("stat-borrowed")
    .textContent =
    borrowed;


  $("stat-users")
    .textContent =
    users.length;


  const statDamaged =
    $("stat-damaged");

  if (statDamaged) {

    statDamaged.textContent =
      damagedTotal;

  }


  renderCategories();

  renderEquipment();

}


/* =====================================================
   CATEGORIES
===================================================== */

function renderCategories() {

  const container =
    $("category-list");


  const categories = [
    "ทั้งหมด",
    ...new Set(
      equipment.map(
        item => item.category
      )
    )
  ];


  container.innerHTML =
    categories.map(category => `

      <button
        class="category-button ${
          activeCategory === category
            ? "active"
            : ""
        }"
        onclick="selectCategory('${escapeHTML(category)}')"
      >
        ${escapeHTML(category)}
      </button>

    `).join("");

}


function selectCategory(category) {

  activeCategory = category;

  renderCategories();

  renderEquipment();

}


/* =====================================================
   EQUIPMENT SEARCH
===================================================== */

function getEquipmentSearch() {

  const input =
    $("equipment-search");

  return input
    ? input.value
        .trim()
        .toLowerCase()
    : "";

}


/* =====================================================
   RENDER EQUIPMENT
===================================================== */

function renderEquipment() {

  const container =
    $("equipment-list");


  const search =
    getEquipmentSearch();


  let items =
    equipment.filter(item => {

      const categoryMatch =
        activeCategory === "ทั้งหมด" ||
        item.category ===
          activeCategory;


      const searchMatch =
        !search ||

        item.name
          .toLowerCase()
          .includes(search) ||

        item.id
          .toLowerCase()
          .includes(search) ||

        item.category
          .toLowerCase()
          .includes(search);


      return (
        categoryMatch &&
        searchMatch
      );

    });


  if (!items.length) {

    container.innerHTML = `

      <div class="card">

        <div class="empty-state">

          <div class="empty-state-icon">
            
          </div>

          ไม่พบอุปกรณ์

        </div>

      </div>

    `;

    return;

  }


  container.innerHTML =
    items.map(item => {

      const damagedCount =
        item.damaged || 0;


      const borrowed =
        item.total -
        item.stock -
        damagedCount;


      return `

        <div class="equipment-item">

          <div class="equipment-info">

            <div class="equipment-name">

              ${escapeHTML(item.name)}

            </div>

            <div class="equipment-code">

              รหัส:
              ${escapeHTML(item.id)}

            </div>


            <div class="equipment-meta">

              <span class="badge badge-category">

                ${escapeHTML(item.category)}

              </span>


              <span class="badge badge-available">

                พร้อมใช้ ${item.stock}

              </span>


              ${
                borrowed > 0
                  ? `

                    <span class="badge badge-borrowed">

                      ถูกยืม ${borrowed}

                    </span>

                  `
                  : ""
              }


              ${
                damagedCount > 0
                  ? `

                    <span class="badge badge-damaged">

                      ชำรุด ${damagedCount}

                    </span>

                  `
                  : ""
              }

            </div>

          </div>


          <div class="equipment-actions">

            <button
              class="icon-button"
              onclick="editEquipment('${item.id}')"
              title="แก้ไข"
            >
              
            </button>


            <button
              class="icon-button delete"
              onclick="deleteEquipment('${item.id}')"
              title="ลบ"
            >
              
            </button>

          </div>

        </div>

      `;

    }).join("");

}


/* =====================================================
   EQUIPMENT MODAL
===================================================== */

function openEquipmentModal(id = null) {

  editingEquipmentId = id;


  const modal =
    $("equipment-modal");


  if (!modal) {
    return;
  }


  if (id) {

    const item =
      equipment.find(
        eq => eq.id === id
      );


    if (!item) {
      return;
    }


    $("equipment-modal-title")
      .textContent =
      "แก้ไขอุปกรณ์";


    $("equipment-id").value =
      item.id;

    $("equipment-code").value =
      item.id;

    $("equipment-name").value =
      item.name;

    $("equipment-category").value =
      item.category;

    $("equipment-total").value =
      item.total;

    $("equipment-stock").value =
      item.stock;

  } else {

    $("equipment-modal-title")
      .textContent =
      "เพิ่มอุปกรณ์";


    $("equipment-form").reset();

    $("equipment-id").value = "";

  }


  modal.style.display =
    "flex";

}


function closeEquipmentModal() {

  const modal =
    $("equipment-modal");

  if (modal) {

    modal.style.display =
      "none";

  }

  editingEquipmentId = null;

}


/* =====================================================
   SAVE EQUIPMENT
===================================================== */

function saveEquipment(event) {

  event.preventDefault();


  const id =
    $("equipment-code")
      .value
      .trim();


  const name =
    $("equipment-name")
      .value
      .trim();


  const category =
    $("equipment-category")
      .value
      .trim();


  const total =
    Number(
      $("equipment-total").value
    );


  const stock =
    Number(
      $("equipment-stock").value
    );


  if (
    !id ||
    !name ||
    !category
  ) {

    showToast(
      "กรุณากรอกข้อมูลให้ครบ"
    );

    return;

  }


  if (
    total < 0 ||
    stock < 0 ||
    stock > total
  ) {

    showToast(
      "จำนวนอุปกรณ์ไม่ถูกต้อง"
    );

    return;

  }


  if (editingEquipmentId) {

    const item =
      equipment.find(
        eq =>
          eq.id ===
          editingEquipmentId
      );


    if (item) {

      item.id = id;

      item.name = name;

      item.category =
        category;

      item.total = total;

      item.stock = stock;

    }


    showToast(
      "แก้ไขอุปกรณ์สำเร็จ"
    );

  } else {

    const exists =
      equipment.some(
        eq => eq.id === id
      );


    if (exists) {

      showToast(
        "รหัสอุปกรณ์นี้มีอยู่แล้ว"
      );

      return;

    }


    equipment.push({

      id,

      name,

      category,

      total,

      stock

    });


    showToast(
      "เพิ่มอุปกรณ์สำเร็จ"
    );

  }


  closeEquipmentModal();

  renderAdminDashboard();

}


/* =====================================================
   EDIT
===================================================== */

function editEquipment(id) {

  openEquipmentModal(id);

}


/* =====================================================
   DELETE
===================================================== */

function deleteEquipment(id) {

  const item =
    equipment.find(
      eq => eq.id === id
    );


  if (!item) {
    return;
  }


  const confirmed =
    confirm(
      `ต้องการลบ "${item.name}" หรือไม่?`
    );


  if (!confirmed) {
    return;
  }


  equipment =
    equipment.filter(
      eq => eq.id !== id
    );


  renderAdminDashboard();

  showToast(
    "ลบอุปกรณ์แล้ว"
  );

}


/* =====================================================
   ADMIN LOGS
===================================================== */

function openLogsModal() {

  renderAdminLogs();

  $("logs-modal")
    .style.display =
    "flex";

}


function closeLogsModal() {

  $("logs-modal")
    .style.display =
    "none";

}


function renderAdminLogs() {

  const container =
    $("admin-logs-list");


  if (!logs.length) {

    container.innerHTML = `

      <div class="empty-state">
        ไม่มีรายการ
      </div>

    `;

    return;

  }


  container.innerHTML =
    logs.map(log => `

      <div class="log-item">

        <div class="log-header">

          <div class="log-user">

            ${escapeHTML(log.user)}

          </div>

          <span class="log-action ${
            log.action === "ชำรุด"
              ? "damaged"
              : ""
          }">

            ${escapeHTML(log.action)}

          </span>

        </div>


        <div class="log-details">

          <div>
            รหัสพนักงาน:
            <strong>
              ${escapeHTML(log.employeeId)}
            </strong>
          </div>

          <div>
            อุปกรณ์:
            <strong>
              ${escapeHTML(log.equipmentName)}
            </strong>
          </div>

          <div>
            รหัสอุปกรณ์:
            ${escapeHTML(log.equipmentId)}
          </div>

          <div>
            วันที่ยืม:
            ${escapeHTML(log.borrowDate)}
          </div>

          <div>
            กำหนดคืน:
            ${escapeHTML(log.dueDate)}
          </div>

          ${
            log.returnDate
              ? `
                <div>
                  วันที่คืน:
                  ${escapeHTML(log.returnDate)}
                </div>
              `
              : ""
          }

        </div>

      </div>

    `).join("");

}


/* =====================================================
   DAMAGED EQUIPMENT
===================================================== */

function openDamagedModal() {

  renderDamagedList();

  $("damaged-modal")
    .style.display =
    "flex";

}


function closeDamagedModal() {

  $("damaged-modal")
    .style.display =
    "none";

}


function renderDamagedList() {

  const container =
    $("damaged-list");

  if (!container) {
    return;
  }


  const damagedItems =
    equipment.filter(
      item => (item.damaged || 0) > 0
    );


  const damagedLogs =
    logs.filter(
      log => log.action === "ชำรุด"
    );


  if (!damagedItems.length) {

    container.innerHTML = `

      <div class="empty-state">

        <div class="empty-state-icon">
          
        </div>

        ไม่มีอุปกรณ์ชำรุด

      </div>

    `;

    return;

  }


  const summaryHTML =
    damagedItems.map(item => `

      <div class="equipment-item">

        <div class="equipment-info">

          <div class="equipment-name">

            ${escapeHTML(item.name)}

          </div>

          <div class="equipment-code">

            รหัส:
            ${escapeHTML(item.id)}

          </div>


          <div class="equipment-meta">

            <span class="badge badge-category">

              ${escapeHTML(item.category)}

            </span>


            <span class="badge badge-damaged">

              ชำรุด ${item.damaged || 0}

            </span>

          </div>

        </div>

      </div>

    `).join("");


  const historyHTML =
    damagedLogs.length
      ? damagedLogs.map(log => `

          <div class="log-item">

            <div class="log-header">

              <div class="log-user">

                ${escapeHTML(log.user)}

              </div>

              <span class="log-action damaged">

                ${escapeHTML(log.action)}

              </span>

            </div>


            <div class="log-details">

              <div>
                รหัสพนักงาน:
                <strong>
                  ${escapeHTML(log.employeeId)}
                </strong>
              </div>

              <div>
                อุปกรณ์:
                <strong>
                  ${escapeHTML(log.equipmentName)}
                </strong>
              </div>

              <div>
                รหัสอุปกรณ์:
                ${escapeHTML(log.equipmentId)}
              </div>

              <div>
                วันที่แจ้งชำรุด:
                ${escapeHTML(log.returnDate)}
              </div>

            </div>

          </div>

        `).join("")
      : "";


  container.innerHTML = `

    <div class="section-title">
      <h2 style="font-size:15px;">
        สรุปอุปกรณ์ชำรุด
      </h2>
    </div>

    ${summaryHTML}

    ${
      historyHTML
        ? `
          <div class="section-title">
            <h2 style="font-size:15px;">
              ประวัติการแจ้งชำรุด
            </h2>
          </div>

          ${historyHTML}
        `
        : ""
    }

  `;

}


/* =====================================================
   QR SCANNER
===================================================== */

function openQRScanner() {

  if (
    !currentUser ||
    currentUser.role !== "admin"
  ) {

    showToast(
      "เฉพาะผู้ดูแลระบบเท่านั้น"
    );

    return;

  }


  switchView("qr-scanner");

  startQRScanner();

}


async function startQRScanner() {

  const reader =
    $("qr-reader");


  if (!reader) {
    return;
  }


  await stopQRScanner();


  $("scanner-status")
    .textContent =
    "กำลังเปิดกล้อง...";


  try {

    qrScanner =
      new Html5Qrcode(
        "qr-reader"
      );


    await qrScanner.start(

      {
        facingMode: "environment"
      },

      {
        fps: 10,

        qrbox: {
          width: 250,
          height: 250
        }

      },

      onQRCodeSuccess,

      onQRCodeError

    );


    isScannerRunning = true;


    $("scanner-status")
      .textContent =
      "พร้อมสแกน QR Code";


  } catch (error) {

    console.error(
      "QR Scanner Error:",
      error
    );


    $("scanner-status")
      .textContent =
      "ไม่สามารถเปิดกล้องได้";


    showToast(
      "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้อง"
    );

  }

}


function onQRCodeSuccess(
  decodedText
) {

  if (!decodedText) {
    return;
  }


  const user =
    findUserFromQR(
      decodedText
    );


  if (!user) {

    $("scanner-status")
      .textContent =
      "ไม่พบผู้ใช้งานจาก QR Code";


    showToast(
      "ไม่พบข้อมูลผู้ใช้งาน"
    );

    return;

  }


  showScanResult(user);


  $("scanner-status")
    .textContent =
    "สแกนสำเร็จ";


  showToast(
    `พบผู้ใช้งาน: ${user.name}`
  );


  stopQRScanner();

}


function onQRCodeError(errorMessage) {

  // ไม่ต้องแสดงทุก error
  // เพราะ scanner จะเรียกฟังก์ชันนี้บ่อยมาก

}


/* =====================================================
   FIND USER FROM QR
===================================================== */

function findUserFromQR(
  qrData
) {

  const value =
    String(qrData)
      .trim()
      .toLowerCase();


  return users.find(user =>

    user.employeeId
      .toLowerCase() === value ||

    user.username
      .toLowerCase() === value

  );

}


/* =====================================================
   SHOW SCAN RESULT
===================================================== */

function showScanResult(user) {

  if (!user) {
    return;
  }


  scannedUser = user;


  $("scan-user-name")
    .textContent =
    user.name;


  $("scan-user-id")
    .textContent =
    user.employeeId;


  $("scan-user-department")
    .textContent =
    user.department;


  const borrowCount =
    logs.filter(log =>

      log.employeeId ===
        user.employeeId &&

      log.action === "ยืม" &&

      !log.returnDate

    ).length;


  $("scan-borrow-count")
    .textContent =
    `${borrowCount} รายการ`;


  $("qr-result")
    .style.display =
    "flex";

}


/* =====================================================
   BORROW / RETURN MODAL
===================================================== */

function openBorrowReturnModal() {

  if (!scannedUser) {

    showToast(
      "กรุณาสแกน QR Code ผู้ใช้งานก่อน"
    );

    return;

  }


  const modal =
    $("borrow-return-modal");

  if (!modal) {
    return;
  }


  $("transaction-user").textContent =
    `${scannedUser.name} (${scannedUser.employeeId})`;

  $("transaction-user-name").textContent =
    scannedUser.name;

  $("transaction-user-id").textContent =
    scannedUser.employeeId;


  populateTransactionEquipmentOptions();

  selectTransactionType("borrow");

  $("transaction-quantity").value = 1;


  const dueDateInput =
    $("transaction-due-date");

  if (dueDateInput) {

    const defaultDue =
      new Date(
        Date.now() +
        3 * 24 * 60 * 60 * 1000
      );

    dueDateInput.value =
      formatDateTimeLocal(defaultDue);

  }


  updateTransactionSummary();


  modal.style.display =
    "flex";

}


function closeBorrowReturnModal() {

  const modal =
    $("borrow-return-modal");

  if (modal) {

    modal.style.display =
      "none";

  }

}


function formatDateTimeLocal(date) {

  const pad = n =>
    String(n).padStart(2, "0");

  return (
    date.getFullYear() +
    "-" + pad(date.getMonth() + 1) +
    "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) +
    ":" + pad(date.getMinutes())
  );

}


function selectTransactionType(type) {

  transactionType = type;


  const borrowButton =
    $("transaction-borrow");

  const returnButton =
    $("transaction-return");

  const damagedButton =
    $("transaction-damaged");


  if (borrowButton) {

    borrowButton.classList.toggle(
      "active",
      type === "borrow"
    );

  }


  if (returnButton) {

    returnButton.classList.toggle(
      "active",
      type === "return"
    );

  }


  if (damagedButton) {

    damagedButton.classList.toggle(
      "active",
      type === "damaged"
    );

  }


  const dueDateGroup =
    $("due-date-group");

  if (dueDateGroup) {

    dueDateGroup.style.display =
      type === "borrow"
        ? "block"
        : "none";

  }


  populateTransactionEquipmentOptions();

  updateTransactionSummary();

}


function getActiveUserBorrowLogs() {

  if (!scannedUser) {
    return [];
  }


  return logs.filter(log =>

    log.employeeId ===
      scannedUser.employeeId &&

    log.action === "ยืม" &&

    !log.returnDate

  );

}


function populateTransactionEquipmentOptions() {

  const select =
    $("transaction-equipment");

  if (!select) {
    return;
  }


  if (transactionType === "borrow") {

    const available =
      equipment.filter(
        item => item.stock > 0
      );


    if (!available.length) {

      select.innerHTML =
        `<option value="">ไม่มีอุปกรณ์พร้อมให้ยืม</option>`;

    } else {

      select.innerHTML =
        available.map(item => `

          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name)} (${escapeHTML(item.id)})
          </option>

        `).join("");

    }

  } else {

    const borrowedLogs =
      getActiveUserBorrowLogs();


    if (!borrowedLogs.length) {

      select.innerHTML =
        `<option value="">ไม่มีรายการอุปกรณ์ที่อยู่ระหว่างการยืมอยู่</option>`;

    } else {

      select.innerHTML =
        borrowedLogs.map(log => `

          <option value="${escapeHTML(log.equipmentId)}">
            ${escapeHTML(log.equipmentName)} (${escapeHTML(log.equipmentId)})
          </option>

        `).join("");

    }

  }


  updateEquipmentAvailabilityHint();

}


function updateEquipmentAvailabilityHint() {

  const select =
    $("transaction-equipment");

  const hint =
    $("equipment-availability");

  if (!select || !hint) {
    return;
  }


  const equipmentId =
    select.value;


  if (!equipmentId) {

    hint.textContent = "-";

    return;

  }


  if (transactionType === "borrow") {

    const item =
      equipment.find(
        eq => eq.id === equipmentId
      );


    hint.textContent = item
      ? `พร้อมใช้งาน ${item.stock} จาก ${item.total} ชิ้น`
      : "-";

  } else {

    const activeLogs =
      getActiveUserBorrowLogs()
        .filter(log =>
          log.equipmentId === equipmentId
        );


    const borrowedQuantity =
      activeLogs.length;


    hint.textContent =
      `กำลังยืมอยู่ ${borrowedQuantity} ชิ้น`;

  }

}


function updateTransactionSummary() {

  const summary =
    $("transaction-summary");

  if (!summary) {
    return;
  }


  const select =
    $("transaction-equipment");

  const equipmentId =
    select ? select.value : "";


  const quantity =
    Number(
      $("transaction-quantity").value
    ) || 0;


  if (!equipmentId || quantity < 1) {

    summary.textContent =
      "กรุณาเลือกอุปกรณ์";

    return;

  }


  if (transactionType === "borrow") {

    const item =
      equipment.find(
        eq => eq.id === equipmentId
      );


    if (!item) {

      summary.textContent =
        "ไม่พบข้อมูลอุปกรณ์";

      return;

    }


    if (quantity > item.stock) {

      summary.textContent =
        `จำนวนที่ต้องการยืม (${quantity}) มากกว่าจำนวนที่พร้อมใช้งาน (${item.stock})`;

      return;

    }


    const dueDateInput =
      $("transaction-due-date");

    const dueDateText =
      dueDateInput && dueDateInput.value
        ? dueDateInput.value.replace("T", " ")
        : "-";


    summary.textContent =
      `ยืม "${item.name}" จำนวน ${quantity} ชิ้น กำหนดคืน ${dueDateText}`;

  } else if (transactionType === "damaged") {

    const activeLogs =
      getActiveUserBorrowLogs()
        .filter(log =>
          log.equipmentId === equipmentId
        );


    if (quantity > activeLogs.length) {

      summary.textContent =
        `จำนวนที่ต้องการแจ้งชำรุด (${quantity}) มากกว่าจำนวนที่ยืมอยู่ (${activeLogs.length})`;

      return;

    }


    const name =
      activeLogs.length
        ? activeLogs[0].equipmentName
        : equipmentId;


    summary.textContent =
      `แจ้งชำรุด "${name}" จำนวน ${quantity} ชิ้น (จะไม่ถูกนำกลับเข้าสต็อก)`;

  } else {

    const activeLogs =
      getActiveUserBorrowLogs()
        .filter(log =>
          log.equipmentId === equipmentId
        );


    if (quantity > activeLogs.length) {

      summary.textContent =
        `จำนวนที่ต้องการคืน (${quantity}) มากกว่าจำนวนที่ยืมอยู่ (${activeLogs.length})`;

      return;

    }


    const name =
      activeLogs.length
        ? activeLogs[0].equipmentName
        : equipmentId;


    summary.textContent =
      `คืน "${name}" จำนวน ${quantity} ชิ้น`;

  }

}


function confirmTransaction() {

  if (!scannedUser) {

    showToast(
      "ไม่พบข้อมูลผู้ใช้งาน"
    );

    return;

  }


  const select =
    $("transaction-equipment");

  const equipmentId =
    select ? select.value : "";


  const quantity =
    Number(
      $("transaction-quantity").value
    ) || 0;


  if (!equipmentId) {

    showToast(
      "กรุณาเลือกอุปกรณ์"
    );

    return;

  }


  if (quantity < 1) {

    showToast(
      "กรุณาระบุจำนวนให้ถูกต้อง"
    );

    return;

  }


  if (transactionType === "borrow") {

    processBorrow(
      equipmentId,
      quantity
    );

  } else if (transactionType === "damaged") {

    processDamaged(
      equipmentId,
      quantity
    );

  } else {

    processReturn(
      equipmentId,
      quantity
    );

  }

}


function processBorrow(equipmentId, quantity) {

  const item =
    equipment.find(
      eq => eq.id === equipmentId
    );


  if (!item) {

    showToast(
      "ไม่พบข้อมูลอุปกรณ์"
    );

    return;

  }


  if (quantity > item.stock) {

    showToast(
      "จำนวนอุปกรณ์ไม่พอสำหรับการยืม"
    );

    return;

  }


  const dueDateInput =
    $("transaction-due-date");

  const dueDateValue =
    dueDateInput && dueDateInput.value
      ? dueDateInput.value.replace("T", " ")
      : "-";


  const now = new Date();

  const nowText =
    formatDateTimeLocal(now)
      .replace("T", " ");


  item.stock -= quantity;


  for (let i = 0; i < quantity; i++) {

    logs.unshift({

      user: scannedUser.name,

      employeeId: scannedUser.employeeId,

      equipmentId: item.id,

      equipmentName: item.name,

      action: "ยืม",

      borrowDate: nowText,

      dueDate: dueDateValue,

      returnDate: null

    });

  }


  showToast(
    `บันทึกการยืม "${item.name}" จำนวน ${quantity} ชิ้นสำเร็จ`
  );


  finishTransaction();

}


function processReturn(equipmentId, quantity) {

  const activeLogs =
    getActiveUserBorrowLogs()
      .filter(log =>
        log.equipmentId === equipmentId
      );


  if (quantity > activeLogs.length) {

    showToast(
      "จำนวนอุปกรณ์ที่คืนมากกว่าจำนวนที่ยืมอยู่"
    );

    return;

  }


  const item =
    equipment.find(
      eq => eq.id === equipmentId
    );


  const now = new Date();

  const nowText =
    formatDateTimeLocal(now)
      .replace("T", " ");


  const logsToReturn =
    activeLogs.slice(0, quantity);


  logsToReturn.forEach(log => {

    log.returnDate = nowText;

  });


  if (item) {

    item.stock =
      Math.min(
        item.total,
        item.stock + quantity
      );

  }


  const name =
    logsToReturn.length
      ? logsToReturn[0].equipmentName
      : equipmentId;


  showToast(
    `บันทึกการคืน "${name}" จำนวน ${quantity} ชิ้นสำเร็จ`
  );


  finishTransaction();

}


function processDamaged(equipmentId, quantity) {

  const activeLogs =
    getActiveUserBorrowLogs()
      .filter(log =>
        log.equipmentId === equipmentId
      );


  if (quantity > activeLogs.length) {

    showToast(
      "จำนวนอุปกรณ์ที่แจ้งชำรุดมากกว่าจำนวนที่ยืมอยู่"
    );

    return;

  }


  const item =
    equipment.find(
      eq => eq.id === equipmentId
    );


  const now = new Date();

  const nowText =
    formatDateTimeLocal(now)
      .replace("T", " ");


  const logsToMark =
    activeLogs.slice(0, quantity);


  logsToMark.forEach(log => {

    log.action = "ชำรุด";

    log.returnDate = nowText;

  });


  if (item) {

    item.damaged =
      (item.damaged || 0) + quantity;

  }


  const name =
    logsToMark.length
      ? logsToMark[0].equipmentName
      : equipmentId;


  showToast(
    `บันทึกอุปกรณ์ชำรุด "${name}" จำนวน ${quantity} ชิ้นแล้ว`
  );


  finishTransaction();

}


function finishTransaction() {

  closeBorrowReturnModal();


  if (scannedUser) {

    showScanResult(scannedUser);

  }


  if (
    currentUser &&
    currentUser.role === "admin"
  ) {

    renderAdminDashboard();

  }

}


/* =====================================================
   MOCK QR SCAN
===================================================== */



/* =====================================================
   STOP QR SCANNER
===================================================== */

async function stopQRScanner() {

  if (!qrScanner) {
    return;
  }


  try {

    if (isScannerRunning) {

      await qrScanner.stop();

    }

  } catch (error) {

    console.warn(
      "Stop scanner:",
      error
    );

  }


  try {

    qrScanner.clear();

  } catch (error) {

    // ignore
  }


  qrScanner = null;

  isScannerRunning = false;

}


function closeQRScanner() {

  stopQRScanner();

  const result =
    $("qr-result");

  if (result) {

    result.style.display =
      "none";

  }


  scannedUser = null;


  switchView(
    "admin-dashboard",
    false
  );

}


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {


    /* Login */
    const loginForm =
      $("login-form");


    if (loginForm) {

      loginForm.addEventListener(
        "submit",
        handleLogin
      );

    }


    /* Equipment */
    const equipmentForm =
      $("equipment-form");


    if (equipmentForm) {

      equipmentForm.addEventListener(
        "submit",
        saveEquipment
      );

    }


    /* Search */
    const search =
      $("equipment-search");


    if (search) {

      search.addEventListener(
        "input",
        renderEquipment
      );

    }


    /* Close modal when click outside */
    const equipmentModal =
      $("equipment-modal");


    if (equipmentModal) {

      equipmentModal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            equipmentModal
          ) {

            closeEquipmentModal();

          }

        }
      );

    }


    const logsModal =
      $("logs-modal");


    if (logsModal) {

      logsModal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            logsModal
          ) {

            closeLogsModal();

          }

        }
      );

    }


    const damagedModal =
      $("damaged-modal");


    if (damagedModal) {

      damagedModal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            damagedModal
          ) {

            closeDamagedModal();

          }

        }
      );

    }


    /* Borrow / Return modal */
    const borrowReturnModal =
      $("borrow-return-modal");


    if (borrowReturnModal) {

      borrowReturnModal.addEventListener(
        "click",
        event => {

          if (
            event.target ===
            borrowReturnModal
          ) {

            closeBorrowReturnModal();

          }

        }
      );

    }


    const transactionEquipment =
      $("transaction-equipment");


    if (transactionEquipment) {

      transactionEquipment.addEventListener(
        "change",
        () => {

          updateEquipmentAvailabilityHint();

          updateTransactionSummary();

        }
      );

    }


    const transactionQuantity =
      $("transaction-quantity");


    if (transactionQuantity) {

      transactionQuantity.addEventListener(
        "input",
        updateTransactionSummary
      );

    }


    const transactionDueDate =
      $("transaction-due-date");


    if (transactionDueDate) {

      transactionDueDate.addEventListener(
        "input",
        updateTransactionSummary
      );

    }


    /* Initial state */
    selectRole("user");

    updateHeader();

  }
);


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.selectRole =
  selectRole;

window.handleLogin =
  handleLogin;

window.handleLogout =
  handleLogout;

window.switchView =
  switchView;

window.goBack =
  goBack;

window.openEquipmentModal =
  openEquipmentModal;

window.closeEquipmentModal =
  closeEquipmentModal;

window.editEquipment =
  editEquipment;

window.deleteEquipment =
  deleteEquipment;

window.openLogsModal =
  openLogsModal;

window.closeLogsModal =
  closeLogsModal;

window.openDamagedModal =
  openDamagedModal;

window.closeDamagedModal =
  closeDamagedModal;

window.selectCategory =
  selectCategory;

window.openQRScanner =
  openQRScanner;

window.closeQRScanner =
  closeQRScanner;


window.openBorrowReturnModal =
  openBorrowReturnModal;

window.closeBorrowReturnModal =
  closeBorrowReturnModal;

window.selectTransactionType =
  selectTransactionType;

window.confirmTransaction =
  confirmTransaction;

/* =====================================================
   V2 ADDITIONS
   - เก็บข้อมูลถาวร (localStorage) / รองรับ QR อุปกรณ์ (?eq=รหัส)
   - หน้ารายละเอียดอุปกรณ์ เบิก-คืนเอง / อนุมัติ / ค้นหา / รายงาน / จัดการผู้ใช้
===================================================== */



const seedLoc = ["ชั้นวาง A", "ตู้ B", "ชั้นวาง C", "ตู้ B"];
equipment.forEach((e, i) => {
  if (e.location === undefined) e.location = seedLoc[i % 4];
  if (e.image === undefined) e.image = "";
  if (e.highValue === undefined) e.highValue = i === 0;
  if (e.damaged === undefined) e.damaged = 0;
});

let detailId = null, catCat = "ทั้งหมด", pendingImage = "", scanHandled = false;
let pendingEq = new URLSearchParams(location.search).get("eq");

const nowStr = () => formatDateTimeLocal(new Date()).replace("T", " ");
const eqUrl = id => location.href.split(/[?#]/)[0] + "?eq=" + encodeURIComponent(id);
const qrImg = (t, s = 220) => `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=` + encodeURIComponent(t);
const isOverdue = l => l.action === "ยืม" && !l.returnDate && l.approval !== "pending" &&
  /^\d{4}/.test(l.dueDate || "") && l.dueDate < nowStr();
const logState = l =>
  l.action === "ชำรุด" ? "แจ้งชำรุด" :
  l.returnDate ? "คืนแล้ว " + l.returnDate :
  l.approval === "pending" ? "รออนุมัติเบิก" :
  l.approval === "return-pending" ? "รออนุมัติคืน" :
  isOverdue(l) ? "เกินกำหนดคืน" : "ยังไม่คืน";

/* ---------- สถานะอุปกรณ์ (Color Coding) ---------- */
function eqStatus(e) {
  const dm = e.damaged || 0, b = e.total - e.stock - dm;
  if (e.total > 0 && dm >= e.total) return ["damaged", "ชำรุด"];
  if (e.stock <= 0) return ["out", "ของหมด"];
  if (b > 0) return ["borrowed", "ถูกยืมบางส่วน"];
  return ["available", "พร้อมใช้งาน"];
}

function eqCard(e, admin) {
  const H = escapeHTML, [s, t] = eqStatus(e);
  return `<div class="equipment-item st-${s}" data-id="${H(e.id)}" onclick="openDetail('${H(e.id)}')">
    ${e.image ? `<img class="eq-thumb" src="${e.image}" alt="">` : `<div class="eq-thumb"></div>`}
    <div class="equipment-info">
      <div class="equipment-name">${H(e.name)}</div>
      <div class="equipment-code">${H(e.id)} · ${H(e.location || "-")}</div>
      <div class="equipment-meta">
        <span class="badge badge-category">${H(e.category)}</span>
        <span class="badge badge-${s}">${t}</span>
        <span class="badge badge-category">คงเหลือ ${e.stock}/${e.total}</span>
        ${e.damaged > 0 && s !== "damaged" ? `<span class="badge badge-damaged">ชำรุด ${e.damaged}</span>` : ""}
        
      </div>
    </div>
    ${admin ? `<div class="equipment-actions" onclick="event.stopPropagation()">
      <button class="icon-button" onclick="editEquipment('${H(e.id)}')" title="แก้ไข">แก้ไข</button>
      <button class="icon-button" onclick="deleteEquipment('${H(e.id)}')" title="ลบ">ลบ</button></div>` : ""}
  </div>`;
}

const filterEq = (q, cat) => {
  q = q.trim().toLowerCase();
  return equipment.filter(e => (cat === "ทั้งหมด" || e.category === cat) &&
    (!q || (e.name + e.id + e.category + (e.location || "")).toLowerCase().includes(q)));
};

/* ---------- รายการอุปกรณ์ฝั่งผู้ดูแล (แทนของเดิม) ---------- */
function renderEquipment() {
  const l = filterEq($("equipment-search").value, activeCategory);
  $("equipment-list").innerHTML = l.length ? l.map(e => eqCard(e, true)).join("")
    : `<div class="card empty-state"><div class="empty-state-icon"></div>ไม่พบอุปกรณ์</div>`;
}

/* ---------- ค้นหา + แดชบอร์ดสต็อก (ทุกบทบาท) ---------- */
function renderCatalog() {
  const cats = ["ทั้งหมด", ...new Set(equipment.map(e => e.category))];
  $("catalog-categories").innerHTML = cats.map(c =>
    `<button class="category-button ${c === catCat ? "active" : ""}" onclick="catCat=this.textContent.trim();renderCatalog()">${escapeHTML(c)}</button>`).join("");
  const t = equipment.reduce((s, e) => s + e.total, 0), a = equipment.reduce((s, e) => s + e.stock, 0),
        d = equipment.reduce((s, e) => s + (e.damaged || 0), 0);
  $("catalog-stats").innerHTML =
    `<span class="badge badge-available">พร้อมใช้ ${a}</span><span class="badge badge-borrowed">ถูกยืม ${t - a - d}</span><span class="badge badge-damaged">ชำรุด ${d}</span><span class="badge badge-category">ทั้งหมด ${t}</span>`;
  const l = filterEq($("catalog-search").value, catCat);
  $("catalog-list").innerHTML = l.length ? l.map(e => eqCard(e, false)).join("")
    : `<div class="card empty-state"><div class="empty-state-icon"></div>ไม่พบอุปกรณ์</div>`;
}

/* ---------- หน้ารายละเอียดอุปกรณ์ (เปิดจากการสแกน QR) ---------- */
function openDetail(id) {
  detailId = id;
  if (currentView === "equipment-detail") renderDetail(); else switchView("equipment-detail");
}

function renderDetail() {
  const H = escapeHTML, e = equipment.find(x => x.id === detailId), c = $("detail-card");
  const search = `<div class="search-box"><span></span><input type="text" id="detail-search" placeholder="ค้นหาอุปกรณ์ (ชื่อ / รหัส / ตำแหน่ง)..." oninput="detailSearch(this.value)" autocomplete="off"></div><div id="detail-search-results"></div>`;
  if (!e) { c.innerHTML = search + `<div class="card empty-state"><div class="empty-state-icon"></div>ไม่พบอุปกรณ์รหัส ${H(detailId)}</div>`; return; }
  const [s, t] = eqStatus(e), admin = currentUser && currentUser.role === "admin", dm = e.damaged || 0;
  let extra = "";
  if (admin) {
    const g = {};
    logs.filter(l => l.equipmentId === e.id).forEach(l => {
      const k = [l.employeeId, l.borrowDate, l.returnDate, l.action, l.approval].join("|");
      (g[k] = g[k] || { l, n: 0 }).n += l.quantity || 1;
    });
    const rows = Object.values(g).slice(0, 10).map(({ l, n }) => `
      <div class="log-item"><div class="log-header"><span class="log-user">${H(l.user)} ×${n}</span>
        <span class="log-action ${l.action === "ชำรุด" || isOverdue(l) ? "damaged" : ""}">${logState(l)}</span></div>
        <div class="log-details">ยืม ${H(l.borrowDate)} · กำหนดคืน ${H(l.dueDate)}</div></div>`).join("");
    extra = `<div class="card"><h3>เครื่องมือผู้ดูแล</h3><div class="admin-toolbar">
        <button class="primary-button" onclick="printQR('${H(e.id)}')">พิมพ์ QR</button>
        <button class="secondary-button" onclick="editEquipment('${H(e.id)}')">แก้ไข</button></div></div>
      <div class="card qr-card"><h3>QR Code อุปกรณ์</h3><div class="qr-wrapper"><img src="${qrImg(eqUrl(e.id))}" alt="QR"></div></div>
      <div class="card"><h3>ประวัติ / ติดตามสถานะ</h3>${rows || `<div class="empty-state">ยังไม่มีประวัติ</div>`}</div>`;
  } else {
    extra = `<button class="primary-button full-width" onclick="openBorrowPopup()">เลือก</button>
      <p class="field-help" style="text-align:center;margin-top:10px">กด "เลือก" เพื่อระบุจำนวนและยืม · การคืนทำกับเจ้าหน้าที่</p>`;
  }
  c.innerHTML = search + `
  <div class="card detail-card st-${s}">
    ${e.image ? `<img class="detail-img" src="${e.image}" alt="">` : `<div class="detail-img"></div>`}
    <span class="badge badge-${s} big">${t}</span>
    <div class="result-row"><span>ชื่ออุปกรณ์</span><strong>${H(e.name)}</strong></div>
    <div class="result-row"><span>รหัสอุปกรณ์</span><strong>${H(e.id)}</strong></div>
    <div class="result-row"><span>ประเภท</span><strong>${H(e.category)}</strong></div>
    <div class="result-row"><span>จำนวนคงเหลือ / ทั้งหมด</span><strong>${e.stock} / ${e.total}</strong></div>
    <div class="result-row"><span>ตำแหน่งจัดเก็บ</span><strong>${H(e.location || "-")}</strong></div>
    <div class="result-row"><span>สถานะ</span><strong>${t}${dm ? ` (ชำรุด ${dm})` : ""}</strong></div>
  </div>` + extra;
}

function detailSearch(q) {
  const box = $("detail-search-results"); if (!box) return;
  const l = q.trim() ? filterEq(q, "ทั้งหมด").slice(0, 8) : [];
  box.innerHTML = q.trim() ? (l.length ? l.map(e => eqCard(e, false)).join("") : `<div class="card empty-state">ไม่พบอุปกรณ์</div>`) : "";
}

/* ---------- อนุมัติเบิก-คืน (ผู้ดูแล) ---------- */
function pendingGroups() {
  const g = {};
  logs.filter(l => l.approval === "pending" || l.approval === "return-pending").forEach(l =>
    (g[[l.employeeId, l.equipmentId, l.borrowDate, l.approval].join("|")] ||= []).push(l));
  return Object.values(g);
}

function renderApprovals() {
  const box = $("approval-box"); if (!box) return;
  const g = pendingGroups(), od = logs.filter(isOverdue).length, H = escapeHTML;
  box.innerHTML = (od ? `<div class="notice notice-red">เกินกำหนดคืน ${od} รายการ (ดูในเมนูรายงาน)</div>` : "") +
    (g.length ? `<div class="card"><h3>รออนุมัติ (${g.length})</h3>${g.map((a, i) => `
      <div class="log-item"><div class="log-header"><span class="log-user">${H(a[0].user)}</span>
        <span class="log-action">${a[0].approval === "pending" ? "ขอเบิก" : "ขอคืน"} ×${a.length}</span></div>
        <div class="log-details">${H(a[0].equipmentName)}</div>
        <div class="modal-actions"><button class="secondary-button" onclick="decide(${i},false)">ปฏิเสธ</button>
        <button class="primary-button" onclick="decide(${i},true)">อนุมัติ</button></div></div>`).join("")}</div>` : "");
}

function decide(i, ok) {
  const g = pendingGroups()[i]; if (!g) return;
  const e = equipment.find(x => x.id === g[0].equipmentId), borrow = g[0].approval === "pending", now = nowStr();
  g.forEach(l => {
    if (borrow) { if (ok) l.approval = "approved"; else { logs.splice(logs.indexOf(l), 1); if (e) e.stock++; } }
    else if (ok) { l.returnDate = now; l.approval = "approved"; if (e) e.stock = Math.min(e.total - (e.damaged || 0), e.stock + 1); }
    else l.approval = "approved";
  });
  renderAdminDashboard();
  showToast(ok ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
}

const _rad = renderAdminDashboard;
renderAdminDashboard = function () { _rad(); renderApprovals(); };

/* ---------- ให้ admin ทำรายการแทนผู้ใช้ไม่นับรายการที่รออนุมัติ ---------- */
function getActiveUserBorrowLogs() {
  return scannedUser ? logs.filter(l => l.employeeId === scannedUser.employeeId && l.action === "ยืม" &&
    !l.returnDate && l.approval !== "pending" && l.approval !== "return-pending") : [];
}

/* ---------- สแกน QR (ทุกบทบาท: อุปกรณ์ / ผู้ใช้) ---------- */
function openQRScanner() {
  if (!currentUser) return;
  scanHandled = false;
  resetScanAfter();
  switchView("qr-scanner");
  startQRScanner();
}

function onQRCodeSuccess(text) {
  if (!text || scanHandled) return;
  const m = String(text).match(/[?&]eq=([^&]+)/), id = (m ? decodeURIComponent(m[1]) : String(text)).trim().toLowerCase();
  const e = equipment.find(x => x.id.toLowerCase() === id);
  if (e) {
    scanHandled = true; stopQRScanner();
    historyStack.pop();
    currentView = currentUser.role === "admin" ? "admin-dashboard" : "user-dashboard";
    openDetail(e.id);
    return;
  }
  const u = currentUser && currentUser.role === "admin" && findUserFromQR(text);
  if (u) { scanHandled = true; showScanResult(u); $("scanner-status").textContent = "สแกนสำเร็จ"; stopQRScanner(); return; }
  $("scanner-status").textContent = "ไม่พบข้อมูลจาก QR Code";
}


function closeQRScanner() {
  stopQRScanner();
  $("qr-result").style.display = "none";
  resetScanAfter();
  scannedUser = null;
  switchView(historyStack.pop() || (currentUser && currentUser.role === "admin" ? "admin-dashboard" : "user-dashboard"), false);
}

function printQR(id) {
  const e = equipment.find(x => x.id === id), w = window.open("", "_blank");
  if (!e || !w) return showToast("เบราว์เซอร์บล็อกหน้าต่างพิมพ์");
  w.document.write(`<body style="text-align:center;font-family:sans-serif"><h2>${escapeHTML(e.name)}</h2>
    <img src="${qrImg(eqUrl(id), 300)}" onload="print()"><h3>${escapeHTML(id)} · ${escapeHTML(e.location || "")}</h3></body>`);
  w.document.close();
}

/* ---------- ฟอร์มอุปกรณ์: ตำแหน่ง / รูปภาพ / มูลค่าสูง ---------- */
const _oem = openEquipmentModal;
openEquipmentModal = function (id = null) {
  _oem(id);
  const e = equipment.find(x => x.id === id) || {};
  $("equipment-location").value = e.location || "";
  $("equipment-highvalue").checked = !!e.highValue;
  $("equipment-image").value = "";
  pendingImage = e.image || "";
};

const _se = saveEquipment;
saveEquipment = function (ev) {
  _se(ev);
  if ($("equipment-modal").style.display !== "none") return;
  const e = equipment.find(x => x.id === $("equipment-code").value.trim());
  if (e) {
    e.location = $("equipment-location").value.trim();
    e.image = pendingImage;
    e.highValue = $("equipment-highvalue").checked;
    if (e.damaged === undefined) e.damaged = 0;
  }
  renderAdminDashboard();
  if (currentView === "equipment-detail") renderDetail();
};

function loadImage(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 320 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = im.width * s; c.height = im.height * s;
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      pendingImage = c.toDataURL("image/jpeg", 0.7);
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}

/* ---------- จัดการผู้ใช้งาน (Admin) ---------- */
function renderUsers() {
  const H = escapeHTML;
  $("user-list").innerHTML = users.map((u, i) => `
    <div class="equipment-item" style="cursor:default">
      <div class="eq-thumb">${u.role === "admin" ? "" : ""}</div>
      <div class="equipment-info"><div class="equipment-name">${H(u.name)}</div>
        <div class="equipment-code">${H(u.employeeId)} · ${H(u.username)} · ${H(u.department)}</div>
        <div class="equipment-meta"><span class="badge badge-category">${u.role === "admin" ? "ผู้ดูแลคลัง" : "ผู้ใช้งาน"}</span></div></div>
      <div class="equipment-actions"><button class="icon-button" onclick="deleteUser(${i})">ลบ</button></div>
    </div>`).join("");
}
function openUserModal() { $("user-form").reset(); $("user-modal").style.display = "flex"; }
function closeUserModal() { $("user-modal").style.display = "none"; }
function saveUser(ev) {
  ev.preventDefault();
  const v = id => $(id).value.trim(),
        u = { name: v("u-name"), employeeId: v("u-emp"), username: v("u-user"), password: $("u-pass").value,
              department: v("u-dept") || "-", role: $("u-role").value };
  if (users.some(x => x.username === u.username || x.employeeId === u.employeeId))
    return showToast("ชื่อผู้ใช้หรือรหัสพนักงานซ้ำ");
  users.push(u); closeUserModal(); renderUsers(); showToast("เพิ่มผู้ใช้งานแล้ว");
}
function deleteUser(i) {
  const u = users[i];
  if (u === currentUser) return showToast("ลบบัญชีที่กำลังใช้งานไม่ได้");
  if (u.role === "admin" && users.filter(x => x.role === "admin").length < 2) return showToast("ต้องมีผู้ดูแลอย่างน้อย 1 คน");
  if (!confirm(`ลบผู้ใช้ "${u.name}" หรือไม่?`)) return;
  users.splice(i, 1); renderUsers();
}

/* ---------- รายงานสรุป ---------- */
function renderReports() {
  const H = escapeHTML, cnt = {};
  logs.forEach(l => cnt[l.equipmentName] = (cnt[l.equipmentName] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top.length ? top[0][1] : 1,
        od = logs.filter(isOverdue), dm = equipment.filter(e => e.damaged > 0);
  $("report-body").innerHTML = `
  <div class="card"><h3>สรุปยอดคงเหลือ</h3><div class="table-wrap"><table class="rp-table">
    <tr><th>รายการ</th><th>คงเหลือ</th><th>ถูกยืม</th><th>ชำรุด</th><th>ทั้งหมด</th></tr>
    ${equipment.map(e => `<tr><td><i class="dot d-${eqStatus(e)[0]}"></i>${H(e.name)}</td><td>${e.stock}</td><td>${e.total - e.stock - (e.damaged || 0)}</td><td>${e.damaged || 0}</td><td>${e.total}</td></tr>`).join("")}
  </table></div></div>
  <div class="card"><h3>ถูกยืมบ่อยที่สุด</h3>${top.map(([n, c]) =>
    `<div class="bar-row"><span>${H(n)}</span><div class="bar"><i style="width:${c / mx * 100}%"></i></div><b>${c}</b></div>`).join("") || "ยังไม่มีข้อมูล"}</div>
  <div class="card"><h3>อุปกรณ์ชำรุด (ใช้วางแผนจัดซื้อ)</h3>${dm.map(e =>
    `<div class="result-row"><span>${H(e.name)}</span><strong>${e.damaged} ชิ้น</strong></div>`).join("") || "ไม่มี"}</div>
  <div class="card"><h3>เกินกำหนดคืน</h3>${od.map(l =>
    `<div class="result-row"><span>${H(l.user)} – ${H(l.equipmentName)}</span><strong>ครบ ${H(l.dueDate)}</strong></div>`).join("") || "ไม่มี"}</div>
  <button class="primary-button full-width" onclick="exportCSV()">⬇ส่งออกประวัติเบิก-คืน (CSV)</button>`;
}

function exportCSV() {
  const r = [["ผู้ใช้", "รหัสพนักงาน", "รหัสอุปกรณ์", "อุปกรณ์", "รายการ", "วันที่ยืม", "กำหนดคืน", "วันที่คืน", "สถานะ"],
    ...logs.map(l => [l.user, l.employeeId, l.equipmentId, l.equipmentName, l.action, l.borrowDate, l.dueDate, l.returnDate || "", logState(l)])];
  const b = new Blob(["\ufeff" + r.map(x => x.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = "toolhub-history.csv"; a.click();
}

/* ---------- Header / Navigation ---------- */
function updateHeader() {
  const T = { login: "ToolFlow", "user-dashboard": "หน้าหลัก", "user-history": "ประวัติการยืมคืน",
    "admin-dashboard": "ผู้ดูแลระบบ", "qr-scanner": "สแกน QR Code", catalog: "ค้นหาอุปกรณ์",
    "equipment-detail": "รายละเอียดอุปกรณ์", reports: "รายงาน", users: "จัดการผู้ใช้งาน" },
    l = currentView === "login";
  $("page-title").textContent = T[currentView] || "ToolFlow";
  $("back-button").style.display = l ? "none" : "block";
  $("logout-button").style.display = l ? "none" : "block";
  document.body.classList.toggle("on-login", l);
}

const _sv = switchView;
switchView = function (v, a) {
  _sv(v, a);
  ({ catalog: renderCatalog, "equipment-detail": renderDetail, reports: renderReports, users: renderUsers }[v] || (() => {}))();
};

/* เปิดจากลิงก์ QR (สแกนด้วยแอปกล้อง) → เข้าสู่ระบบแล้วไปหน้าอุปกรณ์ทันที */
const _hl = handleLogin;
handleLogin = function (ev) {
  const cu = users.find(x => x.username === $("username").value.trim() && x.password === $("password").value);
  if (cu) selectRole(cu.role);   // ไม่ต้องเลือกบทบาท: ระบบดูจากบัญชี
  _hl(ev);
  if (!currentUser) { const f = $("login-form"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); }
  if (currentUser && pendingEq) { const id = pendingEq; pendingEq = null; openDetail(id); }
};

document.addEventListener("DOMContentLoaded", () => {
  updateHeader();
  $("catalog-search").addEventListener("input", renderCatalog);
  $("equipment-image").addEventListener("change", loadImage);
  $("user-form").addEventListener("submit", saveUser);
  $("user-modal").addEventListener("click", e => { if (e.target.id === "user-modal") closeUserModal(); });
  if (pendingEq) showToast("เข้าสู่ระบบเพื่อดูอุปกรณ์ " + pendingEq);
});

function togglePw() { const p = $("password"); p.type = p.type === "password" ? "text" : "password"; }

/* =====================================================
   เชื่อมหน้าเว็บกับฐานข้อมูลผ่าน REST API (backend)
   - ข้อมูล equipment / logs / users ในหน้าเว็บเป็นแค่ "แคช" ที่ดึงจากฐานข้อมูลหลังล็อกอินและหลังทุกการกระทำ
   - ผู้ใช้: สแกน QR → ดูข้อมูล → ส่งคำขอยืม (คืนเองไม่ได้)
   - เจ้าหน้าที่: ยืนยัน/ปฏิเสธการยืม และกดรับคืน
===================================================== */
let token = null;

async function api(method, path, body) {
  let r;
  try {
    r = await fetch(path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) },
      body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error(location.protocol === "file:" ? "เปิดไฟล์ตรงๆ ไม่ได้ ต้องรัน npm start แล้วเปิด http://localhost:3000" : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "เกิดข้อผิดพลาด (" + r.status + ")");
  return d;
}

const fmtDate = iso => iso ? formatDateTimeLocal(new Date(iso)).replace("T", " ") : null;
const toLog = t => ({ txId: t.id, user: t.userName, employeeId: t.userId, equipmentId: t.equipmentId, equipmentName: t.equipmentName,
  quantity: t.quantity, action: t.status === "damaged" ? "ชำรุด" : "ยืม", borrowDate: fmtDate(t.borrowedAt),
  dueDate: String(t.dueDate || "").replace("T", " "), returnDate: ["returned", "damaged"].includes(t.status) ? fmtDate(t.returnedAt) : null,
  approval: t.status === "pending" ? "pending" : "approved" });
const upsert = e => { const i = equipment.findIndex(x => x.id === e.id); i < 0 ? equipment.push(e) : (equipment[i] = e); };

async function sync() {
  equipment = await api("GET", "/api/equipment");
  logs = (await api("GET", "/api/transactions")).filter(t => t.status !== "rejected").map(toLog);
  if (currentUser && currentUser.role === "admin") users.splice(0, users.length, ...(await api("GET", "/api/users")));
}

/* ---------- เข้า/ออกจากระบบ ---------- */
handleLogin = async function (ev) {
  ev.preventDefault();
  try {
    const r = await api("POST", "/api/login", { username: $("username").value.trim(), password: $("password").value });
    token = r.token; currentUser = r.user; historyStack = [];
    await sync();
    switchView(currentUser.role === "admin" ? "admin-dashboard" : "user-dashboard");
    showToast("ยินดีต้อนรับ " + currentUser.name);
    if (pendingEq) { const id = pendingEq; pendingEq = null; openDetail(id); }
  } catch (e) {
    showToast("" + e.message);
    const f = $("login-form"); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
  }
};
const _ho = handleLogout;
handleLogout = function () { if (token) api("POST", "/api/logout").catch(() => {}); token = null; equipment = []; logs = []; users.splice(0); _ho(); };

/* ---------- ดึงข้อมูลใหม่เมื่อเปลี่ยนหน้า / ทุก 8 วินาทีที่หน้าหลัก ---------- */
const viewRender = { "user-dashboard": () => renderUserDashboard(), "admin-dashboard": () => renderAdminDashboard(), catalog: () => renderCatalog(),
  "user-history": () => renderUserHistory(), reports: () => renderReports(), users: () => renderUsers() };
async function refresh() { if (!token) return; try { await sync(); (viewRender[currentView] || (() => {}))(); } catch (e) {} }
const _sv2 = switchView;
switchView = function (v, a) { _sv2(v, a); refresh(); };
setInterval(() => { if (currentView === "admin-dashboard" || currentView === "user-dashboard") refresh(); }, 8000);

/* ---------- สแกน QR → ดึงข้อมูลอุปกรณ์จากฐานข้อมูล ---------- */
onQRCodeSuccess = async function (text) {
  if (!text || scanHandled) return;
  const m = String(text).match(/[?&]eq=([^&]+)/), id = (m ? decodeURIComponent(m[1]) : String(text)).trim();
  scanHandled = true;
  try {
    const e = await api("GET", "/api/equipment/" + encodeURIComponent(id));
    await stopQRScanner(); upsert(e);
    showScanned(e.id);
  } catch (err) { scanHandled = false; $("scanner-status").textContent = "ไม่พบอุปกรณ์นี้ในฐานข้อมูล"; }
};

openDetail = async function (id) {
  detailId = id;
  try { upsert(await api("GET", "/api/equipment/" + encodeURIComponent(id))); } catch (e) { equipment = equipment.filter(x => x.id !== id); }
  currentView === "equipment-detail" ? renderDetail() : switchView("equipment-detail");
};

/* ---------- ผู้ใช้: ยืมได้อย่างเดียว (ส่งคำขอไปยังเจ้าหน้าที่) ---------- */
function openBorrowPopup() {
  const e = equipment.find(x => x.id === detailId); if (!e) return;
  if (e.stock < 1) return showToast("อุปกรณ์หมด ไม่สามารถยืมได้");
  $("b-info").innerHTML = `<strong>${escapeHTML(e.name)}</strong><br><small>${escapeHTML(e.id)} · ${escapeHTML(e.location || "-")} · คงเหลือ ${e.stock}</small>`;
  $("b-qty").value = 1; $("b-qty").max = e.stock;
  $("b-due").value = formatDateTimeLocal(new Date(Date.now() + 3 * 864e5));
  $("borrow-modal").style.display = "flex";
}
function closeBorrowPopup() { $("borrow-modal").style.display = "none"; }
async function confirmBorrow() {
  const e = equipment.find(x => x.id === detailId), q = parseInt($("b-qty").value) || 0, due = $("b-due").value;
  if (!e) return;
  if (q < 1) return showToast("ระบุจำนวนให้ถูกต้อง");
  if (!due) return showToast("ระบุกำหนดคืน");
  try { await api("POST", "/api/borrow", { equipmentId: e.id, quantity: q, dueDate: due }); closeBorrowPopup(); await sync(); showToast("ส่งคำขอยืมเรียบร้อยแล้ว อยู่ระหว่างรอการยืนยันจากเจ้าหน้าที่"); }
  catch (er) { showToast("" + er.message); try { upsert(await api("GET", "/api/equipment/" + encodeURIComponent(e.id))); } catch (x) {} }
  refreshDetailViews();
}

const _rud = renderUserDashboard;
renderUserDashboard = function () {
  _rud();
  const H = escapeHTML, l = logs.filter(x => x.employeeId === currentUser.employeeId && x.action === "ยืม" && !x.returnDate);
  $("current-borrow-list").innerHTML = l.length ? l.map(x => `
    <div class="borrow-item"><div class="item-header"><div><div class="item-name">${H(x.equipmentName)} × ${x.quantity}</div><div class="item-code">${H(x.equipmentId)}</div></div>
      <span class="history-status borrowed">${x.approval === "pending" ? "รอเจ้าหน้าที่ยืนยัน" : isOverdue(x) ? "เกินกำหนดคืน" : "กำลังยืม"}</span></div>
      <div class="item-details"><div class="item-detail"><span>วันที่ขอยืม</span><strong>${H(x.borrowDate)}</strong></div>
      <div class="item-detail"><span>กำหนดคืน</span><strong>${H(x.dueDate)}</strong></div></div></div>`).join("")
    : `<div class="empty-state"><div class="empty-state-icon"></div><div>ไม่มีรายการอุปกรณ์ที่อยู่ระหว่างการยืม</div></div>`;
};

/* ---------- เจ้าหน้าที่: ยืนยันการยืม / รับคืน / แจ้งชำรุด ---------- */
function renderApprovals() {
  const box = $("approval-box"); if (!box) return;
  const H = escapeHTML, pend = logs.filter(l => l.approval === "pending"),
        out = logs.filter(l => l.action === "ยืม" && !l.returnDate && l.approval === "approved"), od = out.filter(isOverdue).length;
  const row = (l, btns) => `<div class="log-item"><div class="log-header"><span class="log-user">${H(l.user)} (${H(l.employeeId)})</span>
    <span class="log-action ${isOverdue(l) ? "damaged" : ""}">${isOverdue(l) ? "เกินกำหนด" : "กำหนดคืน " + H(l.dueDate)}</span></div>
    <div class="log-details">${H(l.equipmentName)} · ${H(l.equipmentId)} × ${l.quantity}</div><div class="modal-actions">${btns}</div></div>`;
  const none = t => `<div class="empty-state">${t}</div>`;
  box.innerHTML = (od ? `<div class="notice notice-red">เกินกำหนดคืน ${od} รายการ</div>` : "") +
    `<div class="card"><h3>รอยืนยันการยืม (${pend.length})</h3>${pend.map(l => row(l,
      `<button class="secondary-button" onclick="decide('${l.txId}',false)">ปฏิเสธ</button><button class="primary-button" onclick="decide('${l.txId}',true)">ยืนยันการยืม</button>`)).join("") || none("ไม่มีคำขอ")}</div>` +
    `<div class="card"><h3>อุปกรณ์ที่ถูกยืมอยู่ (${out.length})</h3>${out.map(l => row(l,
      `<button class="secondary-button" onclick="markDamaged('${l.txId}')">ชำรุด</button><button class="primary-button" onclick="staffReturn('${l.txId}')">รับคืน</button>`)).join("") || none("ไม่มีรายการ")}</div>`;
}
async function act(path, okMsg) {
  try { await api("POST", path); await sync(); showToast(okMsg); } catch (e) { showToast("" + e.message); }
  renderAdminDashboard();
}
function decide(id, ok) { return act(`/api/transactions/${id}/${ok ? "approve" : "reject"}`, ok ? "ยืนยันการยืมแล้ว" : "ปฏิเสธคำขอแล้ว"); }
function staffReturn(id) { return act(`/api/transactions/${id}/return`, "รับคืนอุปกรณ์แล้ว"); }
function markDamaged(id) { if (confirm("บันทึกว่าอุปกรณ์นี้ชำรุดและไม่กลับเข้าคลังใช่หรือไม่?")) return act(`/api/transactions/${id}/damaged`, "บันทึกชำรุดแล้ว"); }

/* ---------- เจ้าหน้าที่: จัดการอุปกรณ์ / ผู้ใช้ผ่านฐานข้อมูล ---------- */
saveEquipment = async function (ev) {
  ev.preventDefault();
  const b = { id: $("equipment-code").value.trim(), name: $("equipment-name").value.trim(), category: $("equipment-category").value.trim(),
    location: $("equipment-location").value.trim(), image: pendingImage, total: +$("equipment-total").value, stock: +$("equipment-stock").value };
  try {
    editingEquipmentId ? await api("PUT", "/api/equipment/" + encodeURIComponent(editingEquipmentId), b) : await api("POST", "/api/equipment", b);
    await sync(); closeEquipmentModal(); showToast("บันทึกอุปกรณ์แล้ว");
    renderAdminDashboard(); refreshDetailViews();
  } catch (e) { showToast("" + e.message); }
};
deleteEquipment = async function (id) {
  const e = equipment.find(x => x.id === id); if (!e || !confirm(`ต้องการลบ "${e.name}" หรือไม่?`)) return;
  try { await api("DELETE", "/api/equipment/" + encodeURIComponent(id)); await sync(); renderAdminDashboard(); showToast("ลบอุปกรณ์แล้ว"); }
  catch (er) { showToast("" + er.message); }
};
renderUsers = function () {
  const H = escapeHTML;
  $("user-list").innerHTML = users.map(u => `<div class="equipment-item" style="cursor:default"><div class="eq-thumb">${u.role === "admin" ? "" : ""}</div>
    <div class="equipment-info"><div class="equipment-name">${H(u.name)}</div><div class="equipment-code">${H(u.employeeId)} · ${H(u.username)} · ${H(u.department)}</div>
    <div class="equipment-meta"><span class="badge badge-category">${u.role === "admin" ? "เจ้าหน้าที่/ผู้ดูแล" : "ผู้ใช้งาน"}</span></div></div>
    <div class="equipment-actions"><button class="icon-button" title="ตั้งรหัสผ่านใหม่" onclick="resetPw('${H(u.id)}')">เปลี่ยนรหัสผ่าน</button>
    <button class="icon-button" onclick="deleteUser('${H(u.id)}')">ลบ</button></div></div>`).join("");
};
saveUser = async function (ev) {
  ev.preventDefault(); const v = id => $(id).value.trim();
  try {
    await api("POST", "/api/users", { name: v("u-name"), employeeId: v("u-emp"), username: v("u-user"), password: $("u-pass").value, department: v("u-dept"), role: $("u-role").value });
    await sync(); closeUserModal(); renderUsers(); showToast("เพิ่มผู้ใช้งานแล้ว");
  } catch (e) { showToast("" + e.message); }
};
async function deleteUser(id) {
  if (!confirm("ลบผู้ใช้นี้หรือไม่?")) return;
  try { await api("DELETE", "/api/users/" + encodeURIComponent(id)); await sync(); renderUsers(); } catch (e) { showToast("" + e.message); }
}
async function resetPw(id) {
  const p = prompt("ตั้งรหัสผ่านใหม่ (อย่างน้อย 4 ตัวอักษร)"); if (!p) return;
  try { await api("PUT", `/api/users/${encodeURIComponent(id)}/password`, { password: p }); showToast("เปลี่ยนรหัสผ่านแล้ว"); } catch (e) { showToast("" + e.message); }
}

/* =====================================================
   V3: หน้าสแกน QR = ปุ่มจำลองสแกน + แสดงรายละเอียด/หมวดหมู่/ค้นหา/สต็อก "หลังสแกนเสร็จ" + หน้าผู้ใช้แบบใหม่
===================================================== */
/* กันพลาด: ถ้า index.html เป็นไฟล์เก่า ให้ปรับหน้าเว็บให้ตรงกับเวอร์ชันใหม่ตอนโหลด */
(function ensureNewUI() {
  document.querySelectorAll("#user-dashboard .qr-card").forEach(el => el.remove());
  document.querySelectorAll("#user-dashboard button[onclick*=\"'catalog'\"]").forEach(el => el.remove());
})();

let scanCat = "ทั้งหมด";

function renderScanSearch() {
  if (!$("scan-list")) return;
  const cats = ["ทั้งหมด", ...new Set(equipment.map(e => e.category))];
  $("scan-categories").innerHTML = cats.map(c =>
    `<button class="category-button ${c === scanCat ? "active" : ""}" data-cat="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
  const t = equipment.reduce((x, e) => x + e.total, 0), a = equipment.reduce((x, e) => x + e.stock, 0),
        d = equipment.reduce((x, e) => x + (e.damaged || 0), 0);
  $("scan-stats").innerHTML =
    `<span class="badge badge-available">พร้อมใช้ ${a}</span><span class="badge badge-borrowed">ถูกยืม ${t - a - d}</span><span class="badge badge-damaged">ชำรุด ${d}</span>`;
  const l = filterEq($("scan-search").value, scanCat);
  $("scan-list").innerHTML = l.length ? l.map(e => eqCard(e, false)).join("")
    : `<div class="empty-state"><div class="empty-state-icon"></div>ไม่พบอุปกรณ์</div>`;
}

/* ---------- หลังสแกนเสร็จ: รายละเอียดอุปกรณ์ + หมวดหมู่ / ค้นหา / สต็อกคงเหลือ ---------- */
function resetScanAfter() { const a = $("scan-after"); if (a) a.style.display = "none"; }
function refreshDetailViews() { if (currentView === "equipment-detail") renderDetail(); }
function showScanned(id) {
  const e = equipment.find(x => x.id === id);
  $("scanner-status").textContent = "สแกนสำเร็จ" + (e ? ": " + e.name : "");
  $("scan-after").style.display = "block";
  renderScanSearch();
  $("scan-after").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ปุ่มจำลองการสแกน: สุ่มอุปกรณ์จากฐานข้อมูลแล้วทำงานเหมือนสแกน QR จริง */
async function simulateQRScan() {
  if (!equipment.length) { try { await sync(); } catch (e) {} }
  if (!equipment.length) return showToast("ยังไม่มีอุปกรณ์ในระบบให้จำลองสแกน");
  const e = equipment[Math.floor(Math.random() * equipment.length)];
  $("scanner-status").textContent = "กำลังจำลองการสแกน...";
  scanHandled = false;
  await onQRCodeSuccess(e.id);
}

document.addEventListener("DOMContentLoaded", () => {
  $("scan-search").addEventListener("input", renderScanSearch);
  $("scan-categories").addEventListener("click", ev => {
    const b = ev.target.closest("[data-cat]"); if (!b) return;
    scanCat = b.dataset.cat; renderScanSearch();
  });
});

const _svScan = switchView;
switchView = function (v, a) { _svScan(v, a); if (v === "qr-scanner") renderScanSearch(); };

const _refreshScan = refresh;
refresh = async function () { await _refreshScan(); if (currentView === "qr-scanner") renderScanSearch(); };
viewRender["qr-scanner"] = renderScanSearch;

const _rudV3 = renderUserDashboard;
renderUserDashboard = function () {
  _rudV3();
  if (!currentUser) return;
  const mine = logs.filter(x => x.employeeId === currentUser.employeeId && x.action === "ยืม" && !x.returnDate);
  if (!$("u-stat-borrowed")) return;
  $("u-stat-borrowed").textContent = mine.filter(x => x.approval !== "pending").length;
  $("u-stat-pending").textContent = mine.filter(x => x.approval === "pending").length;
  $("u-stat-overdue").textContent = mine.filter(isOverdue).length;
};
viewRender["user-dashboard"] = () => renderUserDashboard();

/* ลบการ์ด "QR Code ของฉัน" ออกจากหน้าผู้ใช้งาน (กันกรณี index.html เป็นไฟล์เก่า) */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("#user-dashboard .qr-card").forEach(el => el.remove());
});

/* =====================================================
   เอฟเฟกต์หิมะตกเล็กๆ ในหน้าเข้าสู่ระบบ (canvas, เคลื่อนไหว)
   - แสดงเฉพาะตอนอยู่หน้า login (body.on-login) และหยุดทำงานเมื่อออกจากหน้านั้น
   - เกล็ดหิมะสีฟ้าอ่อน เพื่อให้มองเห็นบนพื้นหลังขาว
===================================================== */
(function snowEffect() {
  const canvas = document.createElement("canvas");
  canvas.id = "snow-canvas";
  canvas.setAttribute("aria-hidden", "true");
  
  // เพิ่ม 5 บรรทัดนี้ เพื่อให้อยู่เลเยอร์บนสุดและเต็มหน้าจอ
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "9999"; 
  canvas.style.pointerEvents = "none"; // สำคัญมาก! ช่วยให้ทะลุการคลิกได้ จะได้ไม่บัคตอนกดปุ่มล็อกอิน

  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, flakes = [], raf = null, t = 0;
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeFlake(initial) {
    return {
      x: rand(0, W), y: initial ? rand(0, H) : rand(-20, -2),
      r: rand(1, 3.2), vy: rand(0.4, 1.3), drift: rand(0.2, 0.9),
      phase: rand(0, Math.PI * 2), a: rand(0.45, 0.9)
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(110, Math.round(W / 11));
    while (flakes.length < n) flakes.push(makeFlake(true));
    flakes.length = n;
  }

  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    for (const f of flakes) {
      f.y += f.vy;
      f.x += Math.sin(t * f.drift + f.phase) * 0.5;
      if (f.y > H + 5) Object.assign(f, makeFlake(false));
      if (f.x < -5) f.x = W + 5; else if (f.x > W + 5) f.x = -5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(120,165,225,${f.a})`;
      ctx.shadowColor = "rgba(90,140,215,.55)";
      ctx.shadowBlur = f.r * 2;
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const on = document.body.classList.contains("on-login");
    if (on && !raf) { resize(); raf = requestAnimationFrame(frame); }
    if (!on && raf) { cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, W, H); }
  }

  window.addEventListener("resize", () => { if (raf) resize(); });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("DOMContentLoaded", sync);
  sync();
})();

/* =====================================================
   ประวัติการยืมคืน: หน้าตาเหมือนการ์ด "อุปกรณ์ที่กำลังยืม"
===================================================== */
(function wrapHistory() {
  const sec = $("user-history");
  if (!sec || sec.querySelector(".card")) return;   // index.html ใหม่มีการ์ดอยู่แล้ว
  sec.innerHTML = `<div class="card"><div class="section-title"><h2>ประวัติการยืมคืน</h2></div><div id="user-history-list"></div></div>`;
})();

renderUserHistory = function () {
  if (!currentUser) return;
  const H = escapeHTML, box = $("user-history-list");
  const mine = logs.filter(l => l.employeeId === currentUser.employeeId);
  if (!mine.length) {
    box.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div><div>ยังไม่มีประวัติการยืม-คืน</div></div>`;
    return;
  }
  box.innerHTML = mine.map(l => {
    const dmg = l.action === "ชำรุด", back = !!l.returnDate;
    const [cls, txt] = dmg ? ["damaged", "ชำรุด"]
      : back ? ["returned", "คืนแล้ว"]
      : l.approval === "pending" ? ["borrowed", "รอเจ้าหน้าที่ยืนยัน"]
      : isOverdue(l) ? ["damaged", "เกินกำหนดคืน"]
      : ["borrowed", "กำลังยืม"];
    return `<div class="borrow-item"><div class="item-header">
        <div><div class="item-name">${H(l.equipmentName)} × ${l.quantity || 1}</div><div class="item-code">${H(l.equipmentId)}</div></div>
        <span class="history-status ${cls}">${txt}</span></div>
      <div class="item-details">
        <div class="item-detail"><span>วันที่ยืม</span><strong>${H(l.borrowDate)}</strong></div>
        <div class="item-detail"><span>กำหนดคืน</span><strong>${H(l.dueDate)}</strong></div>
        ${back ? `<div class="item-detail"><span>${dmg ? "วันที่แจ้งชำรุด" : "วันที่คืน"}</span><strong>${H(l.returnDate)}</strong></div>` : ""}
      </div></div>`;
  }).join("");
};

/* กันพลาด: ถ้า index.html เก่าไม่มีหน้าต่างยืมอุปกรณ์ ให้สร้างให้ */
(function ensureBorrowModal() {
  if ($("borrow-modal")) return;
  const d = document.createElement("div");
  d.id = "borrow-modal"; d.className = "modal-overlay"; d.style.display = "none";
  d.innerHTML = `<div class="modal"><div class="modal-header"><h2>ยืมอุปกรณ์</h2><button class="modal-close" onclick="closeBorrowPopup()">×</button></div>
    <div id="b-info" class="transaction-user-card" style="display:block"></div>
    <div class="form-group"><label for="b-qty">จำนวน</label><input type="number" id="b-qty" class="quantity-input" min="1" value="1"></div>
    <div class="form-group"><label for="b-due">กำหนดคืน</label><input type="datetime-local" id="b-due"></div>
    <div class="modal-actions"><button type="button" class="secondary-button" onclick="closeBorrowPopup()">ยกเลิก</button><button type="button" class="primary-button" onclick="confirmBorrow()">ส่งคำขอยืม</button></div></div>`;
  document.body.appendChild(d);
})();

/* =====================================================
   ประวัติการยืมคืนอยู่ในหน้าหลักของผู้ใช้ (ไม่แยกหน้า)
===================================================== */
(function historyOnDashboard() {
  const dash = $("user-dashboard");
  if (!dash) return;
  const old = $("user-history");
  if (old) old.remove();                                       // เลิกใช้หน้าแยก
  dash.querySelectorAll("button[onclick*=\"user-history\"]").forEach(b => b.remove());
  if (!dash.querySelector("#user-history-list")) {
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<div class="section-title"><h2>ประวัติการยืมคืน</h2></div><div id="user-history-list"></div>`;
    dash.appendChild(c);
  }
})();

const _rudHist = renderUserDashboard;
renderUserDashboard = function () { _rudHist(); renderUserHistory(); };



/* =====================================================
   USER HOME (หน้าหลักผู้ใช้ แบบแอปมือถือ ตามแบบ TOOLFLOW)
   - เฉพาะหน้า #user-dashboard เท่านั้น หน้าอื่นไม่เปลี่ยน
===================================================== */
(function userHome() {
  const H = escapeHTML;

  /* ---------- วาดฟันเฟือง ---------- */
  function gearPath(cx, cy, ro, ri, n) {
    const pts = [], p = 2 * Math.PI / n;
    for (let i = 0; i < n; i++) {
      [[0, ri], [.14, ro], [.36, ro], [.5, ri], [.75, ri]].forEach(([f, r]) => {
        const t = i * p + f * p - Math.PI / 2;
        pts.push((cx + r * Math.cos(t)).toFixed(1) + "," + (cy + r * Math.sin(t)).toFixed(1));
      });
    }
    return "M" + pts.join("L") + "Z";
  }

  function heroArt() {
    const cx = 205, cy = 135;
    return `<svg viewBox="0 10 400 250" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="gSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2750a8"/><stop offset="1" stop-color="#04245d"/></linearGradient>
        <linearGradient id="gDark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#04245d"/><stop offset="1" stop-color="#12121c"/></linearGradient>
        <linearGradient id="gSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eceef5"/><stop offset="1" stop-color="#9da2b8"/></linearGradient>
        <linearGradient id="gTeal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9da2b8"/><stop offset="1" stop-color="#04245d"/></linearGradient>
        <filter id="gShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#12121c" flood-opacity=".25"/></filter>
      </defs>
      <g fill="none" stroke="#9da2b8" stroke-width="1.2" stroke-dasharray="3 5" opacity=".9">
        <circle cx="${cx}" cy="${cy}" r="132"/>
        <circle cx="${cx}" cy="${cy}" r="150" stroke-dasharray="1 7"/>
        <path d="M${cx - 132} ${cy}H20M${cx + 132} ${cy}H390M${cx} ${cy - 132}V8M${cx} ${cy + 132}V268"/>
      </g>
      <g fill="#9da2b8"><circle cx="20" cy="${cy}" r="3.5"/><circle cx="390" cy="${cy}" r="3.5"/><circle cx="${cx}" cy="8" r="3.5"/></g>
      <g class="g-spin rev" filter="url(#gShadow)"><path d="${gearPath(340, 66, 42, 34, 12)}" fill="url(#gSilver)" stroke="#7b82a0" stroke-width="1.2"/>
        <circle cx="340" cy="66" r="15" fill="#eceef5" stroke="#7b82a0"/></g>
      <g class="g-spin" filter="url(#gShadow)"><path d="${gearPath(352, 214, 34, 27, 10)}" fill="url(#gTeal)" stroke="#12121c" stroke-width="1.2"/>
        <circle cx="352" cy="214" r="12" fill="#eceef5" stroke="#12121c"/></g>
      <g class="g-spin" filter="url(#gShadow)"><path d="${gearPath(cx, cy, 120, 103, 16)}" fill="url(#gSteel)" stroke="#12121c" stroke-width="1.5"/></g>
      <circle cx="${cx}" cy="${cy}" r="92" fill="url(#gDark)"/>
      <circle cx="${cx}" cy="${cy}" r="84" fill="none" stroke="#7b82a0" stroke-width="2" stroke-dasharray="2 6"/>
      <circle cx="${cx}" cy="${cy}" r="68" fill="#eceef5" stroke="#d5d8e7" stroke-width="3"/>
      <g transform="translate(${cx} ${cy})">
        <rect x="-33" y="-36" width="66" height="19" rx="4" fill="#04245d"/>
        <rect x="-11" y="-21" width="22" height="58" rx="4" fill="#04245d"/>
        <circle cx="0" cy="-7" r="4" fill="#eceef5"/><rect x="-3" y="3" width="6" height="22" rx="3" fill="#eceef5"/>
      </g>
    </svg>`;
  }

  /* ---------- ไอคอนอุปกรณ์ ---------- */
  function toolIcon(e) {
    if (e.image) return `<img src="${e.image}" alt="">`;
    const t = (e.name + " " + e.category);
    const P = d => `<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
    if (t.includes("ไม้ฉาก")) return P('<path d="M4 4v16h16z"/><path d="M8 20v-3M12 20v-5M16 20v-3"/>');
    if (t.includes("เวอร์เนีย") || t.includes("ไม้บรรทัด")) return P('<rect x="2" y="9" width="20" height="6" rx="1"/><path d="M6 9v3M10 9v2M14 9v3M18 9v2"/>');
    if (t.includes("สว่าน")) return P('<path d="M3 9h11a3 3 0 013 3v1H3z"/><path d="M17 11h4M7 13v6h4v-6"/>');
    if (t.includes("ค้อน")) return P('<path d="M14 4l6 6-3 3-6-6z"/><path d="M12 9L4 17l3 3 8-8"/>');
    return P('<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a6 6 0 01-7.9 7.9l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9a6 6 0 017.9-7.9z"/>');
  }

  /* ---------- เรนเดอร์หน้าหลัก ---------- */
  function renderHome() {
    if (!currentUser || !$("uh-tools")) return;
    const T = equipment.reduce((s, e) => s + e.total, 0), A = equipment.reduce((s, e) => s + e.stock, 0),
          D = equipment.reduce((s, e) => s + (e.damaged || 0), 0);
    const eff = T ? Math.round(A / T * 100) + "%" : "-", rdy = A + " / " + T;
    $("uh-eff").textContent = eff;  $("uh-ready").textContent = rdy;
    $("uh-eff2").textContent = eff; $("uh-ready2").textContent = rdy;
    $("uh-s-total").textContent = T; $("uh-s-avail").textContent = A;
    $("uh-s-borrowed").textContent = T - A - D; $("uh-s-damaged").textContent = D;

    const mine = logs.filter(x => x.employeeId === currentUser.employeeId && x.action === "ยืม" && !x.returnDate);
    const n = mine.filter(x => x.approval === "pending" || isOverdue(x)).length;
    $("uh-badge").textContent = n; $("uh-badge").style.display = n ? "block" : "none";

    const PAL = ["#2f6b9a","#2b8fb3","#5568b0","#7a67b0","#2e8b7a","#cf4444","#2f7fa8","#8a62a8"];
    const list = [...equipment].sort((a, b) => (b.stock > 0) - (a.stock > 0)).slice(0, 8);
    $("uh-tools").innerHTML = list.length ? list.map((e, i) => `
      <button type="button" class="uh-tool ${e.stock > 0 ? "" : "out"}" style="--c:${PAL[i % PAL.length]}" data-id="${H(e.id)}">
        <span class="uh-tool-img">${toolIcon(e)}</span><span class="uh-tool-name">${H(e.name)}</span></button>`).join("")
      : `<div class="uh-empty">ยังไม่มีอุปกรณ์</div>`;
  }

  const _rudHome = renderUserDashboard;
  renderUserDashboard = function () { _rudHome(); renderHome(); };
  viewRender["user-dashboard"] = () => renderUserDashboard();

  /* ---------- แท็บ ---------- */
  const titles = { home: "หน้าหลัก", list: "รายการเบิก-คืน", stats: "สถิติ", profile: "โปรไฟล์" };
  window.uhTab = function (name) {
    document.querySelectorAll("#user-dashboard .uh-panel").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
    document.querySelectorAll("#user-dashboard .uh-nav [data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    const nav = document.querySelector('#user-dashboard .uh-nav [data-go]');
    if (nav) nav.classList.remove("active");
    window.scrollTo(0, 0);
  };

  $("uh-hero-art").innerHTML = heroArt();
  $("uh-cog").innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${gearPath(12, 12, 11, 8.6, 8)}"/><circle cx="12" cy="12" r="3.6" fill="#fff"/></svg>`;

  document.querySelectorAll("#user-dashboard .uh-nav [data-tab]").forEach(b => b.addEventListener("click", () => uhTab(b.dataset.tab)));
  document.querySelectorAll("#user-dashboard [data-go]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.go)));
  $("uh-bell").addEventListener("click", () => uhTab("list"));
  $("uh-cog").addEventListener("click", () => uhTab("profile"));
  $("uh-quick").addEventListener("click", () => switchView("catalog"));
  $("uh-scan").addEventListener("click", () => openQRScanner());
  $("uh-logout").addEventListener("click", () => handleLogout());
  $("uh-tools").addEventListener("click", ev => { const b = ev.target.closest("[data-id]"); if (b) openDetail(b.dataset.id); });

  /* ---------- ซ่อนแถบหัวเว็บเดิมเฉพาะหน้าหลักผู้ใช้ ---------- */
  const _svHome = switchView;
  switchView = function (v, a) {
    _svHome(v, a);
    document.body.classList.toggle("on-home", currentView === "user-dashboard");
  };
  const _hoHome = handleLogout;
  handleLogout = function () { _hoHome(); uhTab("home"); document.body.classList.remove("on-home"); };
})();