"use strict";
const $ = id => document.getElementById(id);
const DEFAULT_QUERY = "Quy định nghỉ phép của tôi như thế nào?";
const STATUS = {answered:"Có chính sách áp dụng",refused:"Chưa có chính sách phù hợp",needs_clarification:"Cần làm rõ",out_of_scope:"Ngoài phạm vi",invalid_request:"Yêu cầu không hợp lệ",conflict:"Chính sách cần làm rõ",system_error:"Dữ liệu chưa sẵn sàng",insufficient_evidence:"Chưa đủ căn cứ"};
let personas = {}, result = null, controller = null, requestNumber = 0, ready = false;

function busy(value) {
  $("submit").disabled = value || !ready;
  $("submit").textContent = value ? "Đang tra cứu…" : "Tra cứu ↗";
  document.querySelector(".results-card").setAttribute("aria-busy", String(value));
}

function clearResult() {
  result = null;
  $("answer").replaceChildren();
  $("answer-date").textContent = "";
  $("citations").replaceChildren();
  $("source-details").replaceChildren();
  $("trace").textContent = "Chưa có kết quả tra cứu.";
  $("graph").srcdoc = "";
  $("graph").hidden = true;
  $("graph-empty").hidden = false;
  $("graph-empty").textContent = "Chưa có kết quả tra cứu.";
  $("download").disabled = true;
  $("status").textContent = "Đang tra cứu…";
  $("status").dataset.state = "loading";
}

function updateProfile() {
  const profile = personas[$("persona").value];
  if (!profile) return;
  $("avatar").textContent = profile.name.slice(0, 1).toUpperCase();
  $("profile-name").textContent = profile.name;
  $("profile-description").textContent = profile.description;
  $("scope").textContent = profile.scope_path.join(" → ");
}

function inline(parent, text) {
  text.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      parent.append(strong);
    } else parent.append(document.createTextNode(part));
  });
}

function renderAnswer(text) {
  let list = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let node;
    if (line.startsWith("- ")) {
      if (!list) { list = document.createElement("ul"); $("answer").append(list); }
      node = document.createElement("li"); inline(node, line.slice(2)); list.append(node);
    } else { list = null; node = document.createElement("p"); inline(node, line.trim()); $("answer").append(node); }
  }
}

function render(data) {
  result = data.result;
  $("status").textContent = STATUS[result.status] || result.status;
  $("status").dataset.state = result.status;
  $("answer-date").textContent = `Áp dụng tại ${result.query_date.split("-").reverse().join("/")}`;
  renderAnswer(result.answer);
  for (const source of result.citations) {
    const tag = document.createElement("span"); tag.className = "citation";
    tag.textContent = `${source.doc_id} ${source.version} · ${source.clause}`;
    $("citations").append(tag);
    const detail = document.createElement("div"); detail.className = "source-detail";
    const title = document.createElement("strong"); title.textContent = source.title;
    const info = document.createElement("p"); info.textContent = `${source.doc_id} ${source.version} · ${source.clause} · ${source.source_ref.path}:${source.source_ref.line}`;
    detail.append(title, info); $("source-details").append(detail);
  }
  $("trace").textContent = JSON.stringify(result.trace, null, 2);
  const hasGraph = result.graph.nodes.length > 0;
  $("graph-empty").hidden = hasGraph;
  $("graph-empty").textContent = "Không có dữ liệu graph cho kết quả này.";
  $("graph").hidden = !hasGraph;
  $("graph").srcdoc = hasGraph ? data.graph_html : "";
  $("download").disabled = !hasGraph;
}

async function fetchJSON(options = {}) {
  const response = await fetch("/api", {...options, cache:"no-store"});
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Không đọc được phản hồi từ máy chủ. Vui lòng thử lại."); }
  if (!response.ok) throw new Error(data.error || "Không thể tra cứu lúc này. Vui lòng thử lại.");
  return data;
}

async function ask(query = $("query").value) {
  if (!ready) return;
  const current = ++requestNumber;
  controller?.abort(); controller = new AbortController();
  clearResult(); $("error").hidden = true;
  if (!$("date").checkValidity()) {
    $("date").reportValidity(); busy(false);
    $("status").textContent = "Chọn ngày hợp lệ";
    return;
  }
  busy(true);
  try {
    const data = await fetchJSON({method:"POST", headers:{"Content-Type":"application/json"}, signal:controller.signal,
      body:JSON.stringify({persona:$("persona").value, date:$("date").value, query})});
    if (current === requestNumber) render(data);
  } catch (error) {
    if (error.name === "AbortError" || current !== requestNumber) return;
    $("error-message").textContent = error.message;
    $("error").hidden = false;
    $("status").textContent = "Chưa thể tra cứu";
    $("status").dataset.state = "system_error";
  } finally { if (current === requestNumber) busy(false); }
}

async function initialize() {
  $("error").hidden = true; busy(true);
  try {
    const data = await fetchJSON(); personas = data.personas;
    $("persona").replaceChildren();
    for (const [id, profile] of Object.entries(personas)) {
      const option = document.createElement("option"); option.value = id;
      option.textContent = `${profile.name} · ${profile.role}`; $("persona").append(option);
    }
    $("date").value = data.date;
    $("persona").disabled = false; $("date").disabled = false;
    ready = true; updateProfile(); await ask(DEFAULT_QUERY);
  } catch (error) {
    $("error-message").textContent = error.message; $("error").hidden = false;
    $("status").textContent = "Chưa tải được dữ liệu";
    $("status").dataset.state = "system_error";
  } finally { busy(false); }
}

$("question-form").addEventListener("submit", event => { event.preventDefault(); ask(); });
$("persona").addEventListener("change", () => { updateProfile(); ask(); });
$("date").addEventListener("change", () => ask());
$("retry").addEventListener("click", () => ready ? ask() : initialize());
document.querySelectorAll("[data-query]").forEach(button => button.addEventListener("click", () => { $("query").value = button.dataset.query; ask(); }));
const tabs = [...document.querySelectorAll(".tab")];
function selectTab(tab) {
  tabs.forEach(button => {
    const active = button === tab; button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
    $("panel-" + button.dataset.panel).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }
  });
});
$("download").addEventListener("click", () => {
  if (!result?.graph.nodes.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result.graph, null, 2)], {type:"application/json"}));
  const link = document.createElement("a"); link.href = url; link.download = "knowledge_projection.json";
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
initialize();
