"""Demo UI. All policy content comes from one authorized backend projection."""
import json

import streamlit as st

from engine.core import KnowledgeAssistant
from engine.graph_view import graph_html
from engine.metadata import snapshot_from_bytes
from engine.models import MetadataError
from engine.snapshot import BusinessClock, DEFAULT_SCHEMA
from engine.storage import runtime_data_bytes

st.set_page_config(page_title="Appota Knowledge V2", page_icon="🏢", layout="wide")


@st.cache_resource(max_entries=2)
def validated_snapshot(data_bytes, schema_bytes):
    return snapshot_from_bytes(data_bytes, schema_bytes)


def load_assistant():
    try:
        snapshot = validated_snapshot(runtime_data_bytes(), DEFAULT_SCHEMA.read_bytes())
    except (MetadataError, OSError):
        st.error("Dữ liệu chính sách chưa sẵn sàng. Vui lòng liên hệ người quản trị.")
        st.stop()
    return KnowledgeAssistant(snapshot=snapshot)


def show_graph(graph):
    if not graph["nodes"]:
        st.info("Không có dữ liệu graph cho kết quả này.")
        return
    st.iframe(graph_html(graph), height=650)
    st.download_button("Xuất graph JSON", json.dumps(graph, ensure_ascii=False, indent=2),
                       file_name="knowledge_projection.json", mime="application/json")


assistant = load_assistant()
personas = assistant.identity_service.list_users()
st.title("🏢 Appota · Tri thức nội bộ V2")
st.caption("Demo chính sách nghỉ phép · SQLite · Snapshot có validation · Trích dẫn theo clause")
st.sidebar.info("Mock identity cho demo. Chọn persona không thay thế đăng nhập SSO thật.")
uid = st.sidebar.selectbox("Chọn nhân sự", list(personas),
                           format_func=lambda key: f"{personas[key]['name']} · {personas[key]['role']}", key="persona")
as_of = st.sidebar.date_input("Ngày nghiệp vụ", value=BusinessClock().today(), key="business_date")
profile = personas[uid]
st.sidebar.write(profile["description"])
st.sidebar.caption(" → ".join(reversed(assistant.hierarchy_resolver.get_user_scope_path(profile))))
st.sidebar.caption(f"Snapshot: {assistant.snapshot.snapshot_id[:12]}")
context = (uid, as_of.isoformat(), assistant.snapshot.snapshot_id)
if st.session_state.get("answer_context") != context:
    st.session_state.pop("answer_result", None)
    st.session_state["answer_context"] = context

with st.form("question_form"):
    query = st.text_input("Câu hỏi nghỉ phép", value="Quy định nghỉ phép của tôi như thế nào?", key="query")
    submitted = st.form_submit_button("Gửi câu hỏi", type="primary")
if submitted:
    st.session_state["answer_result"] = assistant.answer_query(uid, query, as_of)
result = st.session_state.get("answer_result") or assistant.public_view(uid, as_of)
answer_tab, graph_tab, trace_tab = st.tabs(["Trả lời", "Sơ đồ tri thức", "Trace & nguồn"])
with answer_tab:
    st.caption(f"Trạng thái: {result['status']} · Ngày áp dụng: {result['query_date']}")
    st.markdown(result["answer"])
    if result["status"] == "insufficient_evidence":
        st.warning("Có quy định hiện hành, chưa có căn cứ xử lý ngoại lệ.")
    st.caption("Nguồn demo giả lập. Thời hạn báo trước chưa rõ loại ngày được ghi rõ trong câu trả lời.")
with graph_tab:
    st.caption("Graph do backend chiếu theo persona, ngày và chính sách được phép; không gửi toàn kho xuống browser.")
    show_graph(result["graph"])
with trace_tab:
    st.json(result["trace"])
    for source in result["citations"]:
        st.info(f"{source['doc_id']} {source['version']} · {source['clause']} · {source['title']}")
