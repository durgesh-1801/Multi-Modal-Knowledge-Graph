"""
Knowledge Graph Database Interface & Neo4j Integration.

Defines an abstract graph interface and provides both:
1. `MockGraphInterface`: Lightweight in-memory implementation for offline testing.
2. `Neo4jGraphInterface`: Production implementation using the official Neo4j Python driver,
   Cypher MERGE queries for node/edge deduplication, reference counting, dynamic graph analytics,
   and document lifecycle management.
"""

from abc import ABC, abstractmethod
from datetime import datetime
import re
from typing import Any, Dict, List, Optional
try:
    from neo4j import GraphDatabase, Driver
except ImportError:
    GraphDatabase = None
    Driver = Any  # type: ignore

from app.core.config import settings
from app.core.logging import logger
from app.schemas.graph import (
    GraphNode,
    GraphRelationship,
    GraphStatistics,
    SubgraphResponse,
)
from app.schemas.rag import RAGGraphNode


class AbstractGraphInterface(ABC):
    """
    Abstract Base Class for Knowledge Graph Database adapters.
    """

    @abstractmethod
    def get_related_entities(self, entity_name: str) -> List[Dict[str, Any]]:
        """Retrieves entity nodes and relationships related to entity_name."""
        pass

    @abstractmethod
    def get_subgraph(self, query: str, depth: int = 2) -> SubgraphResponse:
        """Retrieves a subgraph (nodes and connected relationships) matching query terms."""
        pass

    @abstractmethod
    def get_connected_nodes(self, node_id: str, depth: int = 1) -> List[GraphNode]:
        """Retrieves direct neighbor nodes connected to a specific node_id."""
        pass

    @abstractmethod
    def search_graph(self, query: str) -> List[GraphNode]:
        """Searches graph node names, types, and properties matching query terms."""
        pass

    @abstractmethod
    def create_node(self, node: GraphNode) -> GraphNode:
        """Creates or merges an entity node in the graph."""
        pass

    @abstractmethod
    def create_nodes_batch(self, nodes: List[GraphNode]) -> List[GraphNode]:
        """Batch creates or merges a list of entity nodes in the graph."""
        pass

    @abstractmethod
    def create_relationship(self, relationship: GraphRelationship) -> GraphRelationship:
        """Creates or merges a directed relationship edge between two nodes."""
        pass

    @abstractmethod
    def create_relationships_batch(self, relationships: List[GraphRelationship]) -> List[GraphRelationship]:
        """Batch creates or merges a list of directed relationship edges."""
        pass

    @abstractmethod
    def merge_duplicate_entities(self, canonical_name: str, duplicate_names: List[str]) -> bool:
        """Merges duplicate entities into a canonical entity node."""
        pass

    @abstractmethod
    def delete_document_graph(self, document_id: str) -> Dict[str, int]:
        """Deletes edges and orphaned nodes associated with a document ID."""
        pass

    @abstractmethod
    def clear_all(self) -> Dict[str, int]:
        """Wipes all nodes and relationships from the graph database."""
        pass

    @abstractmethod
    def get_graph_statistics(self) -> GraphStatistics:
        """Computes and returns summary analytics for the knowledge graph."""
        pass


class MockGraphInterface(AbstractGraphInterface):
    """
    Pluggable Mock Graph Interface returning synthetic compliance graph data for local offline use.
    """

    def __init__(self) -> None:
        self._nodes: Dict[str, GraphNode] = {}
        self._edges: List[GraphRelationship] = []

    def get_related_entities(self, entity_name: str) -> List[Dict[str, Any]]:
        logger.info(f"MockGraphInterface.get_related_entities('{entity_name}')")
        results = []
        name_low = entity_name.lower()
        for node in self._nodes.values():
            if name_low in node.name.lower() or any(name_low in a.lower() for a in node.aliases):
                rel_edges = [
                    {"type": e.type, "target": e.target}
                    for e in self._edges
                    if e.source.lower() == node.id.lower()
                ]
                results.append(
                    {
                        "source": node.name,
                        "label": node.type,
                        "relations": rel_edges,
                        "properties": node.properties,
                    }
                )
        return results

    def get_subgraph(self, query: str = "", depth: int = 2) -> SubgraphResponse:
        logger.info(f"MockGraphInterface.get_subgraph('{query}', depth={depth})")
        if not query or not query.strip():
            unique_nodes = list({n.id: n for n in self._nodes.values()}.values())
            return SubgraphResponse(nodes=unique_nodes, edges=list(self._edges))
        matched_nodes = self.search_graph(query)
        matched_ids = {n.id.lower() for n in matched_nodes}

        sub_edges = [
            e for e in self._edges
            if e.source.lower() in matched_ids or e.target.lower() in matched_ids
        ]
        return SubgraphResponse(nodes=matched_nodes, edges=sub_edges)

    def get_connected_nodes(self, node_id: str, depth: int = 1) -> List[GraphNode]:
        target_id = node_id.lower()
        connected_ids = {target_id}
        for edge in self._edges:
            if edge.source.lower() == target_id:
                connected_ids.add(edge.target.lower())
            elif edge.target.lower() == target_id:
                connected_ids.add(edge.source.lower())

        return [n for nid, n in self._nodes.items() if nid in connected_ids]

    def search_graph(self, query: str) -> List[GraphNode]:
        logger.info(f"MockGraphInterface.search_graph('{query}')")
        if not query or not query.strip():
            return list(self._nodes.values())
        query_terms = query.lower().split()
        matched: List[GraphNode] = []

        for node in self._nodes.values():
            searchable = f"{node.name} {node.type} {' '.join(node.aliases)} {str(node.properties)}".lower()
            if any(term in searchable for term in query_terms):
                matched.append(node)

        return matched

    def create_node(self, node: GraphNode) -> GraphNode:
        key = node.id.lower()
        if key in self._nodes:
            existing = self._nodes[key]
            existing.source_documents = list(set(existing.source_documents + node.source_documents))
            existing.page_numbers = list(set(existing.page_numbers + node.page_numbers))
            existing.aliases = list(set(existing.aliases + node.aliases))
            existing.updated_at = datetime.utcnow().isoformat()
            return existing

        self._nodes[key] = node
        return node

    def create_nodes_batch(self, nodes: List[GraphNode]) -> List[GraphNode]:
        for node in nodes:
            self.create_node(node)
        return nodes

    def create_relationship(self, relationship: GraphRelationship) -> GraphRelationship:
        self._edges.append(relationship)
        return relationship

    def create_relationships_batch(self, relationships: List[GraphRelationship]) -> List[GraphRelationship]:
        self._edges.extend(relationships)
        return relationships

    def merge_duplicate_entities(self, canonical_name: str, duplicate_names: List[str]) -> bool:
        canonical_key = canonical_name.lower()
        if canonical_key not in self._nodes:
            return False

        canonical_node = self._nodes[canonical_key]
        for dup in duplicate_names:
            dup_key = dup.lower()
            if dup_key in self._nodes and dup_key != canonical_key:
                dup_node = self._nodes.pop(dup_key)
                canonical_node.aliases.append(dup_node.name)
                canonical_node.source_documents = list(
                    set(canonical_node.source_documents + dup_node.source_documents)
                )

                for e in self._edges:
                    if e.source.lower() == dup_key:
                        e.source = canonical_node.name
                    if e.target.lower() == dup_key:
                        e.target = canonical_node.name
        return True

    def delete_document_graph(self, document_id: str) -> Dict[str, int]:
        edges_before = len(self._edges)
        self._edges = [e for e in self._edges if e.source_document != document_id]
        edges_deleted = edges_before - len(self._edges)

        nodes_deleted = 0
        nodes_to_remove = []
        for nid, node in self._nodes.items():
            if document_id in node.source_documents:
                node.source_documents.remove(document_id)
                if not node.source_documents:
                    nodes_to_remove.append(nid)

        for nid in nodes_to_remove:
            del self._nodes[nid]
            nodes_deleted += 1

        return {"edges_deleted": edges_deleted, "nodes_deleted": nodes_deleted}

    def clear_all(self) -> Dict[str, int]:
        nodes_deleted = len(self._nodes)
        edges_deleted = len(self._edges)
        self._nodes.clear()
        self._edges.clear()
        logger.info(f"MockGraphInterface cleared: {nodes_deleted} nodes, {edges_deleted} edges deleted.")
        return {"nodes_deleted": nodes_deleted, "edges_deleted": edges_deleted}

    def get_graph_statistics(self) -> GraphStatistics:
        unique_nodes = list({n.id: n for n in self._nodes.values()}.values())
        node_cnt = len(unique_nodes)
        edge_cnt = len(self._edges)

        doc_ids = set()
        entity_dist: Dict[str, int] = {}
        degrees: Dict[str, int] = {n.id: 0 for n in unique_nodes}

        for n in unique_nodes:
            doc_ids.update(n.source_documents)
            entity_dist[n.type] = entity_dist.get(n.type, 0) + 1

        rel_dist: Dict[str, int] = {}
        for e in self._edges:
            rel_dist[e.type] = rel_dist.get(e.type, 0) + 1
            src_key = e.source.lower()
            tgt_key = e.target.lower()
            for n in unique_nodes:
                if n.id.lower() == src_key or n.name.lower() == src_key:
                    degrees[n.id] = degrees.get(n.id, 0) + 1
                if n.id.lower() == tgt_key or n.name.lower() == tgt_key:
                    degrees[n.id] = degrees.get(n.id, 0) + 1

        isolated_count = sum(1 for d in degrees.values() if d == 0)

        # BFS for connected components
        adj: Dict[str, set] = {n.id: set() for n in unique_nodes}
        node_by_id = {n.id: n for n in unique_nodes}
        for e in self._edges:
            src_node = next((n for n in unique_nodes if n.id.lower() == e.source.lower() or n.name.lower() == e.source.lower()), None)
            tgt_node = next((n for n in unique_nodes if n.id.lower() == e.target.lower() or n.name.lower() == e.target.lower()), None)
            if src_node and tgt_node:
                adj[src_node.id].add(tgt_node.id)
                adj[tgt_node.id].add(src_node.id)

        visited = set()
        components = []
        for n in unique_nodes:
            if n.id not in visited:
                comp = []
                queue = [n.id]
                visited.add(n.id)
                while queue:
                    curr = queue.pop(0)
                    comp.append(curr)
                    for nxt in adj.get(curr, []):
                        if nxt not in visited:
                            visited.add(nxt)
                            queue.append(nxt)
                components.append(comp)

        largest_comp_size = max([len(c) for c in components], default=0)
        conn_comp_cnt = len(components)

        most_conn = [
            {"name": node_by_id[nid].name, "type": node_by_id[nid].type, "degree": deg}
            for nid, deg in sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:10]
            if nid in node_by_id
        ]

        avg_deg = (2.0 * edge_cnt / node_cnt) if node_cnt > 0 else 0.0
        density = (2.0 * edge_cnt / (node_cnt * (node_cnt - 1))) if node_cnt > 1 else 0.0

        return GraphStatistics(
            node_count=node_cnt,
            relationship_count=edge_cnt,
            document_count=len(doc_ids),
            entity_types=entity_dist,
            relationship_types=rel_dist,
            average_degree=round(avg_deg, 2),
            graph_density=round(density, 4),
            most_connected_entities=most_conn,
            entity_distribution=entity_dist,
            relationship_distribution=rel_dist,
            largest_connected_component_size=largest_comp_size,
            connected_components_count=conn_comp_cnt,
            isolated_nodes_count=isolated_count,
        )


class Neo4jGraphInterface(AbstractGraphInterface):
    """
    Production Neo4j Knowledge Graph Interface implementation using official Neo4j Python Driver.
    Executes parameter-safe Cypher MERGE queries, maintains reference counts, and computes analytics.
    """

    def __init__(
        self,
        uri: Optional[str] = None,
        auth: Optional[tuple] = None,
        database: Optional[str] = None,
        driver: Optional[Driver] = None,
    ) -> None:
        self.uri = uri or settings.NEO4J_URI
        self.username = settings.NEO4J_USERNAME
        self.password = settings.NEO4J_PASSWORD
        self.database = database or getattr(settings, "NEO4J_DATABASE", "neo4j")

        if driver:
            self._driver = driver
        else:
            if GraphDatabase is None:
                raise RuntimeError("The 'neo4j' Python driver package is not installed. Please run 'pip install neo4j'.")
            auth_tuple = auth or (self.username, self.password)
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=auth_tuple,
                max_connection_pool_size=getattr(settings, "NEO4J_MAX_CONNECTION_POOL_SIZE", 50),
            )

    def _read_tx(self, session: Any, func: Any) -> Any:
        if hasattr(session, "execute_read"):
            return session.execute_read(func)
        return session.read_transaction(func)

    def _write_tx(self, session: Any, func: Any) -> Any:
        if hasattr(session, "execute_write"):
            return session.execute_write(func)
        return session.write_transaction(func)

    def close(self) -> None:
        """Closes the Neo4j driver connection pool."""
        if self._driver:
            self._driver.close()

    def get_related_entities(self, entity_name: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (n:Entity)
        WHERE toLower(n.name) CONTAINS toLower($name)
           OR ANY(alias IN n.aliases WHERE toLower(alias) CONTAINS toLower($name))
        OPTIONAL MATCH (n)-[r]->(target:Entity)
        RETURN n.name AS source_name,
               n.type AS source_type,
               n.properties AS properties,
               type(r) AS relation_type,
               target.name AS target_name,
               target.type AS target_type
        """
        results: List[Dict[str, Any]] = []
        with self._driver.session(database=self.database) as session:
            record_list = self._read_tx(session, lambda tx: list(tx.run(query, name=entity_name)))

            entity_map: Dict[str, Dict[str, Any]] = {}
            for rec in record_list:
                src_name = rec["source_name"]
                if not src_name:
                    continue

                if src_name not in entity_map:
                    entity_map[src_name] = {
                        "source": src_name,
                        "label": rec["source_type"] or "Entity",
                        "relations": [],
                        "properties": rec["properties"] or {},
                    }

                if rec["relation_type"] and rec["target_name"]:
                    entity_map[src_name]["relations"].append(
                        {
                            "type": rec["relation_type"],
                            "target": rec["target_name"],
                            "target_label": rec["target_type"] or "Entity",
                        }
                    )

            results = list(entity_map.values())
        return results

    def get_subgraph(self, query: str = "", depth: int = 2) -> SubgraphResponse:
        nodes_map: Dict[str, GraphNode] = {}
        edges_list: List[GraphRelationship] = []

        with self._driver.session(database=self.database) as session:
            if not query or not query.strip():
                # Fetch ALL nodes in database
                cypher_nodes = "MATCH (n:Entity) RETURN n LIMIT 5000"
                rec_nodes = self._read_tx(session, lambda tx: list(tx.run(cypher_nodes)))
                for rec in rec_nodes:
                    node = rec["n"]
                    nid = str(node.get("id", node.get("name", "")))
                    if nid and nid not in nodes_map:
                        nodes_map[nid] = GraphNode(
                            id=nid,
                            name=node.get("name", nid),
                            type=node.get("type", "Entity"),
                            aliases=list(node.get("aliases", [])),
                            source_documents=list(node.get("source_documents", [])),
                            page_numbers=list(node.get("page_numbers", [])),
                            confidence=float(node.get("confidence", 1.0)),
                            created_at=str(node.get("created_at", "")),
                            updated_at=str(node.get("updated_at", "")),
                            properties=dict(node),
                        )

                # Fetch ALL relationships in database
                cypher_edges = """
                MATCH (a:Entity)-[r]->(b:Entity)
                RETURN a.id AS source_id, a.name AS source_name,
                       b.id AS target_id, b.name AS target_name,
                       r
                LIMIT 10000
                """
                rec_edges = self._read_tx(session, lambda tx: list(tx.run(cypher_edges)))
                for rec in rec_edges:
                    src = rec["source_id"] or rec["source_name"]
                    tgt = rec["target_id"] or rec["target_name"]
                    rel = rec["r"]
                    if src and tgt:
                        edges_list.append(
                            GraphRelationship(
                                id=str(getattr(rel, "element_id", getattr(rel, "id", f"{src}_{tgt}"))),
                                source=src,
                                target=tgt,
                                type=getattr(rel, "type", "RELATED"),
                                confidence=float(rel.get("confidence", 1.0)),
                                source_document=rel.get("source_document"),
                                page_number=rel.get("page_number"),
                                properties=dict(rel),
                            )
                        )
            else:
                cypher = """
                MATCH (n:Entity)
                WHERE toLower(n.name) CONTAINS toLower($search_text)
                   OR toLower(n.type) CONTAINS toLower($search_text)
                   OR ANY(alias IN n.aliases WHERE toLower(alias) CONTAINS toLower($search_text))
                WITH n LIMIT 50
                MATCH path = (n)-[r*1..2]-(neighbor:Entity)
                RETURN path LIMIT 500
                """
                records = self._read_tx(session, lambda tx: list(tx.run(cypher, search_text=query)))
                for rec in records:
                    path = rec["path"]
                    if not path:
                        continue
                    for node in path.nodes:
                        node_id = str(node.get("id", node.get("name", "")))
                        if node_id and node_id not in nodes_map:
                            nodes_map[node_id] = GraphNode(
                                id=node_id,
                                name=node.get("name", node_id),
                                type=node.get("type", "Entity"),
                                aliases=list(node.get("aliases", [])),
                                source_documents=list(node.get("source_documents", [])),
                                page_numbers=list(node.get("page_numbers", [])),
                                confidence=float(node.get("confidence", 1.0)),
                                created_at=str(node.get("created_at", "")),
                                updated_at=str(node.get("updated_at", "")),
                                properties=dict(node),
                            )
                    for rel in path.relationships:
                        start_node = rel.start_node.get("id", rel.start_node.get("name"))
                        end_node = rel.end_node.get("id", rel.end_node.get("name"))
                        edges_list.append(
                            GraphRelationship(
                                source=start_node,
                                target=end_node,
                                type=rel.type,
                                confidence=float(rel.get("confidence", 1.0)),
                                source_document=rel.get("source_document"),
                                page_number=rel.get("page_number"),
                            )
                        )

        # Fallback if query returns empty path
        if not nodes_map and query:
            nodes_map = {n.id: n for n in self.search_graph(query)}

        return SubgraphResponse(nodes=list(nodes_map.values()), edges=edges_list)

    def get_connected_nodes(self, node_id: str, depth: int = 1) -> List[GraphNode]:
        cypher = """
        MATCH (n:Entity) WHERE n.id = $node_id OR toLower(n.name) = toLower($node_id)
        MATCH (n)-[r]-(neighbor:Entity)
        RETURN DISTINCT neighbor
        LIMIT 50
        """
        results: List[GraphNode] = []
        with self._driver.session(database=self.database) as session:
            records = self._read_tx(session, lambda tx: list(tx.run(cypher, node_id=node_id)))
            for rec in records:
                node = rec["neighbor"]
                nid = str(node.get("id", node.get("name")))
                results.append(
                    GraphNode(
                        id=nid,
                        name=node.get("name", nid),
                        type=node.get("type", "Entity"),
                        aliases=list(node.get("aliases", [])),
                        source_documents=list(node.get("source_documents", [])),
                        page_numbers=list(node.get("page_numbers", [])),
                        confidence=float(node.get("confidence", 1.0)),
                        created_at=str(node.get("created_at", "")),
                        updated_at=str(node.get("updated_at", "")),
                        properties=dict(node),
                    )
                )
        return results

    def search_graph(self, query: str) -> List[GraphNode]:
        cypher = """
        MATCH (n:Entity)
        WHERE toLower(n.name) CONTAINS toLower($search_text)
           OR toLower(n.type) CONTAINS toLower($search_text)
           OR ANY(alias IN n.aliases WHERE toLower(alias) CONTAINS toLower($search_text))
        RETURN n LIMIT 50
        """
        results: List[GraphNode] = []
        with self._driver.session(database=self.database) as session:
            records = self._read_tx(session, lambda tx: list(tx.run(cypher, search_text=query)))
            for rec in records:
                node = rec["n"]
                nid = str(node.get("id", node.get("name")))
                results.append(
                    GraphNode(
                        id=nid,
                        name=node.get("name", nid),
                        type=node.get("type", "Entity"),
                        aliases=list(node.get("aliases", [])),
                        source_documents=list(node.get("source_documents", [])),
                        page_numbers=list(node.get("page_numbers", [])),
                        confidence=float(node.get("confidence", 1.0)),
                        created_at=str(node.get("created_at", "")),
                        updated_at=str(node.get("updated_at", "")),
                        properties=dict(node),
                    )
                )
        return results

    def create_node(self, node: GraphNode) -> GraphNode:
        cypher = """
        MERGE (n:Entity {id: $id})
        ON CREATE SET n.name = $name,
                      n.type = $type,
                      n.aliases = $aliases,
                      n.source_documents = $source_documents,
                      n.page_numbers = $page_numbers,
                      n.confidence = $confidence,
                      n.created_at = $created_at,
                      n.updated_at = $updated_at
        ON MATCH SET n.name = $name,
                     n.type = $type,
                     n.aliases = [x IN n.aliases WHERE NOT x IN $aliases] + $aliases,
                     n.source_documents = [x IN n.source_documents WHERE NOT x IN $source_documents] + $source_documents,
                     n.page_numbers = [x IN n.page_numbers WHERE NOT x IN $page_numbers] + $page_numbers,
                     n.confidence = CASE WHEN $confidence > n.confidence THEN $confidence ELSE n.confidence END,
                     n.updated_at = $updated_at
        RETURN n
        """
        params = {
            "id": node.id,
            "name": node.name,
            "type": node.type,
            "aliases": node.aliases,
            "source_documents": node.source_documents,
            "page_numbers": node.page_numbers,
            "confidence": node.confidence,
            "created_at": node.created_at,
            "updated_at": node.updated_at,
        }
        with self._driver.session(database=self.database) as session:
            self._write_tx(session, lambda tx: tx.run(cypher, **params))
        return node

    def create_nodes_batch(self, nodes: List[GraphNode]) -> List[GraphNode]:
        if not nodes:
            return []
        cypher = """
        UNWIND $batch AS item
        MERGE (n:Entity {id: item.id})
        ON CREATE SET n.name = item.name,
                      n.type = item.type,
                      n.aliases = item.aliases,
                      n.source_documents = item.source_documents,
                      n.page_numbers = item.page_numbers,
                      n.confidence = item.confidence,
                      n.created_at = item.created_at,
                      n.updated_at = item.updated_at
        ON MATCH SET n.name = item.name,
                     n.type = item.type,
                     n.aliases = [x IN n.aliases WHERE NOT x IN item.aliases] + item.aliases,
                     n.source_documents = [x IN n.source_documents WHERE NOT x IN item.source_documents] + item.source_documents,
                     n.page_numbers = [x IN n.page_numbers WHERE NOT x IN item.page_numbers] + item.page_numbers,
                     n.confidence = CASE WHEN item.confidence > n.confidence THEN item.confidence ELSE n.confidence END,
                     n.updated_at = item.updated_at
        """
        batch_params = [
            {
                "id": node.id,
                "name": node.name,
                "type": node.type,
                "aliases": node.aliases,
                "source_documents": node.source_documents,
                "page_numbers": node.page_numbers,
                "confidence": node.confidence,
                "created_at": node.created_at,
                "updated_at": node.updated_at,
            }
            for node in nodes
        ]
        with self._driver.session(database=self.database) as session:
            self._write_tx(session, lambda tx: tx.run(cypher, batch=batch_params))
        return nodes

    def create_relationship(self, relationship: GraphRelationship) -> GraphRelationship:
        rel_type_clean = re.sub(r"[^A-Za-z0-9_]", "_", relationship.type.upper())
        cypher = f"""
        MATCH (a:Entity) WHERE a.id = $source OR toLower(a.name) = toLower($source)
        MATCH (b:Entity) WHERE b.id = $target OR toLower(b.name) = toLower($target)
        MERGE (a)-[r:{rel_type_clean}]->(b)
        ON CREATE SET r.type = $rel_type,
                      r.confidence = $confidence,
                      r.source_document = $source_document,
                      r.page_number = $page_number,
                      r.created_at = $created_at
        ON MATCH SET r.confidence = CASE WHEN $confidence > r.confidence THEN $confidence ELSE r.confidence END
        RETURN r
        """
        params = {
            "source": relationship.source,
            "target": relationship.target,
            "rel_type": relationship.type,
            "confidence": relationship.confidence,
            "source_document": relationship.source_document,
            "page_number": relationship.page_number,
            "created_at": relationship.created_at,
        }
        with self._driver.session(database=self.database) as session:
            self._write_tx(session, lambda tx: tx.run(cypher, **params))
        return relationship

    def create_relationships_batch(self, relationships: List[GraphRelationship]) -> List[GraphRelationship]:
        if not relationships:
            return []
        
        rel_groups: Dict[str, List[Dict[str, Any]]] = {}
        for r in relationships:
            rel_type_clean = re.sub(r"[^A-Za-z0-9_]", "_", r.type.upper())
            if rel_type_clean not in rel_groups:
                rel_groups[rel_type_clean] = []
            rel_groups[rel_type_clean].append({
                "source": r.source,
                "target": r.target,
                "rel_type": r.type,
                "confidence": r.confidence,
                "source_document": r.source_document,
                "page_number": r.page_number,
                "created_at": r.created_at,
            })

        with self._driver.session(database=self.database) as session:
            for rel_type_clean, batch_params in rel_groups.items():
                cypher = f"""
                UNWIND $batch AS item
                MATCH (a:Entity) WHERE a.id = item.source OR toLower(a.name) = toLower(item.source)
                MATCH (b:Entity) WHERE b.id = item.target OR toLower(b.name) = toLower(item.target)
                MERGE (a)-[r:{rel_type_clean}]->(b)
                ON CREATE SET r.type = item.rel_type,
                              r.confidence = item.confidence,
                              r.source_document = item.source_document,
                              r.page_number = item.page_number,
                              r.created_at = item.created_at
                ON MATCH SET r.confidence = CASE WHEN item.confidence > r.confidence THEN item.confidence ELSE r.confidence END
                """
                self._write_tx(session, lambda tx, c=cypher, b=batch_params: tx.run(c, batch=b))
        return relationships

    def merge_duplicate_entities(self, canonical_name: str, duplicate_names: List[str]) -> bool:
        cypher = """
        MATCH (canonical:Entity) WHERE toLower(canonical.name) = toLower($canonical_name) OR canonical.id = $canonical_name
        MATCH (dup:Entity) WHERE (toLower(dup.name) IN $dup_names OR dup.id IN $dup_names) AND dup <> canonical
        OPTIONAL MATCH (dup)-[r1]->(target:Entity) WHERE target <> canonical
        MERGE (canonical)-[r1_new:RELATED {type: type(r1)}]->(target)
        ON CREATE SET r1_new += properties(r1)
        WITH canonical, dup
        OPTIONAL MATCH (source:Entity)-[r2]->(dup) WHERE source <> canonical
        MERGE (source)-[r2_new:RELATED {type: type(r2)}]->(canonical)
        ON CREATE SET r2_new += properties(r2)
        WITH canonical, dup
        SET canonical.aliases = [x IN canonical.aliases WHERE NOT x IN dup.aliases] + dup.aliases + [dup.name]
        DETACH DELETE dup
        """
        dup_names_lower = [d.lower() for d in duplicate_names]
        with self._driver.session(database=self.database) as session:
            self._write_tx(
                session,
                lambda tx: tx.run(
                    cypher, canonical_name=canonical_name, dup_names=dup_names_lower
                ),
            )
        return True

    def delete_document_graph(self, document_id: str) -> Dict[str, int]:
        cypher_rel_del = """
        MATCH ()-[r]->()
        WHERE r.source_document = $doc_id
        DELETE r
        RETURN count(r) AS deleted_edges
        """
        cypher_node_update = """
        MATCH (n:Entity)
        WHERE $doc_id IN n.source_documents
        SET n.source_documents = [d IN n.source_documents WHERE d <> $doc_id]
        WITH n
        WHERE size(n.source_documents) = 0
        DETACH DELETE n
        RETURN count(n) AS deleted_nodes
        """
        edges_deleted = 0
        nodes_deleted = 0
        with self._driver.session(database=self.database) as session:
            r1 = self._write_tx(session, lambda tx: tx.run(cypher_rel_del, doc_id=document_id).single())
            if r1:
                edges_deleted = r1["deleted_edges"]

            r2 = self._write_tx(session, lambda tx: tx.run(cypher_node_update, doc_id=document_id).single())
            if r2:
                nodes_deleted = r2["deleted_nodes"]

        return {"edges_deleted": edges_deleted, "nodes_deleted": nodes_deleted}

    def clear_all(self) -> Dict[str, int]:
        cypher = "MATCH (n) DETACH DELETE n"
        with self._driver.session(database=self.database) as session:
            self._write_tx(session, lambda tx: tx.run(cypher))
        logger.info("Neo4j database cleared successfully.")
        return {"status": "cleared"}

    def get_graph_statistics(self) -> GraphStatistics:
        cypher_stats = """
        CALL { MATCH (n:Entity) RETURN count(n) AS node_cnt }
        CALL { MATCH ()-[r]->() RETURN count(r) AS rel_cnt }
        CALL { MATCH (n:Entity) UNWIND n.source_documents AS doc RETURN count(DISTINCT doc) AS doc_cnt }
        RETURN node_cnt, rel_cnt, doc_cnt
        """
        cypher_entity_types = "MATCH (n:Entity) RETURN n.type AS type, count(n) AS cnt"
        cypher_rel_types = "MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS cnt"
        cypher_centrality = """
        MATCH (n:Entity)-[r]-()
        RETURN n.name AS name, n.type AS type, count(r) AS degree
        ORDER BY degree DESC LIMIT 10
        """

        node_cnt = 0
        rel_cnt = 0
        doc_cnt = 0
        entity_dist: Dict[str, int] = {}
        rel_dist: Dict[str, int] = {}
        most_connected: List[Dict[str, Any]] = []

        with self._driver.session(database=self.database) as session:
            rec = self._read_tx(session, lambda tx: tx.run(cypher_stats).single())
            if rec:
                node_cnt = rec["node_cnt"]
                rel_cnt = rec["rel_cnt"]
                doc_cnt = rec["doc_cnt"]

            for r in self._read_tx(session, lambda tx: list(tx.run(cypher_entity_types))):
                if r["type"]:
                    entity_dist[r["type"]] = r["cnt"]

            for r in self._read_tx(session, lambda tx: list(tx.run(cypher_rel_types))):
                if r["type"]:
                    rel_dist[r["type"]] = r["cnt"]

            for r in self._read_tx(session, lambda tx: list(tx.run(cypher_centrality))):
                most_connected.append({"name": r["name"], "type": r["type"], "degree": r["degree"]})

        avg_deg = (2.0 * rel_cnt / node_cnt) if node_cnt > 0 else 0.0
        density = (2.0 * rel_cnt / (node_cnt * (node_cnt - 1))) if node_cnt > 1 else 0.0

        return GraphStatistics(
            node_count=node_cnt,
            relationship_count=rel_cnt,
            document_count=doc_cnt,
            entity_types=entity_dist,
            relationship_types=rel_dist,
            average_degree=round(avg_deg, 2),
            graph_density=round(density, 4),
            most_connected_entities=most_connected,
            entity_distribution=entity_dist,
            relationship_distribution=rel_dist,
            largest_connected_component_size=node_cnt,
        )
