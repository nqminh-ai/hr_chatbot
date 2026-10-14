"""Backend-built graph: never send denied nodes to the browser or exports."""
import json

from engine.generator import public_claim
from engine.snapshot import plain


def project_graph(snapshot, profile, documents, resolved=None):
    nodes, edges = {}, []
    def add(node_id, kind, label, metadata):
        nodes[node_id] = {"id": node_id, "kind": kind, "label": label, "metadata": metadata}
    def link(source, target, relation):
        edge = {"source": source, "target": target, "relation": relation}
        if edge not in edges:
            edges.append(edge)
    scopes = snapshot.scope_path(profile)
    for scope in scopes:
        unit = snapshot.units[scope]
        add("unit:" + scope, "unit", unit["name"], plain(unit))
        if unit["parent"] in scopes:
            link("unit:" + unit["parent"], "unit:" + scope, "PARENT_OF")
    add("user:" + profile["user_id"], "persona", profile["name"], dict(profile))
    link("user:" + profile["user_id"], "unit:" + scopes[0], "MEMBER_OF")
    visible_ids = {doc.doc_uid for doc in documents}
    for doc in documents:
        metadata = plain(doc.metadata)
        metadata["supersedes"] = [uid for uid in metadata["supersedes"] if uid in visible_ids]
        add("doc:" + doc.doc_uid, "document", f"{doc.policy_id} {doc.version}", metadata)
        link("doc:" + doc.doc_uid, "unit:" + doc.scope_id, "APPLIES_AT")
        for clause in doc.clauses:
            add("clause:" + clause.clause_id, "clause", clause.key, {
                "text": clause.text, "value": clause.typed_value.value,
                "unit": clause.typed_value.unit, "is_floor": clause.is_floor})
            link("doc:" + doc.doc_uid, "clause:" + clause.clause_id, "HAS_CLAUSE")
    for key, claim in (resolved or {}).items():
        node_id = "claim:" + key
        add(node_id, "claim", key, public_claim(claim))
        link(node_id, "clause:" + claim.clause.clause_id, "CITES")
        if claim.floor_applied:
            link(node_id, "clause:" + claim.clause.clause_id, "DERIVED_FROM")
        for doc, clause in claim.overridden:
            link("clause:" + claim.clause.clause_id, "clause:" + clause.clause_id, "OVERRIDES")
    return {"snapshot_id": snapshot.snapshot_id, "nodes": list(nodes.values()),
            "edges": [e for e in edges if e["source"] in nodes and e["target"] in nodes]}


def graph_to_dot(graph):
    quote = lambda text: json.dumps(str(text), ensure_ascii=False)
    lines = ['digraph knowledge { rankdir=LR; node [shape=box fontname="Arial"];']
    for node in graph["nodes"]:
        lines.append(f'{quote(node["id"])} [label={quote(node["label"])}];')
    for edge in graph["edges"]:
        lines.append(f'{quote(edge["source"])} -> {quote(edge["target"])} '
                     f'[label={quote(edge["relation"])}];')
    return "\n".join(lines + ["}"])
