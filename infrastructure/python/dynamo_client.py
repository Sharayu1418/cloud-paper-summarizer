"""
DynamoDB client for paper metadata, study sessions, and chat history.
"""
import boto3
import uuid
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
from . import config


class DynamoDBClient:
    """Client for DynamoDB operations."""
    
    def __init__(self):
        """Initialize DynamoDB client."""
        self._dynamodb = None
        self._papers_table = None
        self._sessions_table = None
        self._chat_table = None
        self._vectors_table = None
    
    @property
    def dynamodb(self):
        """Lazy initialization of DynamoDB resource."""
        if self._dynamodb is None:
            self._dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
        return self._dynamodb
    
    @property
    def papers_table(self):
        """Get papers metadata table."""
        if self._papers_table is None:
            self._papers_table = self.dynamodb.Table(config.PAPERS_TABLE)
        return self._papers_table
    
    @property
    def sessions_table(self):
        """Get study sessions table."""
        if self._sessions_table is None:
            self._sessions_table = self.dynamodb.Table(config.SESSIONS_TABLE)
        return self._sessions_table
    
    @property
    def chat_table(self):
        """Get chat history table."""
        if self._chat_table is None:
            self._chat_table = self.dynamodb.Table(config.CHAT_HISTORY_TABLE)
        return self._chat_table
    
    @property
    def vectors_table(self):
        """Get user-vector IDs table."""
        if self._vectors_table is None:
            self._vectors_table = self.dynamodb.Table(config.USER_VECTORS_TABLE)
        return self._vectors_table
    
    # ==================== Papers Operations ====================
    
    def create_paper(
        self,
        user_id: str,
        document_id: str,
        title: str,
        s3_key: str,
        authors: Optional[str] = None,
        abstract: Optional[str] = None,
        source: str = "upload",
        status: str = "pending"
    ) -> Dict:
        """
        Create a new paper metadata entry.
        
        Args:
            user_id: Owner user ID
            document_id: Unique document ID
            title: Paper title
            s3_key: S3 object key
            authors: Paper authors
            abstract: Paper abstract
            source: "upload", "semantic_scholar", or "arxiv"
            status: "pending", "processing", "completed", "failed"
            
        Returns:
            Created paper item
        """
        timestamp = int(time.time())
        
        item = {
            "user_id": user_id,
            "document_id": document_id,
            "title": title,
            "s3_key": s3_key,
            "source": source,
            "status": status,
            "created_at": timestamp,
            "updated_at": timestamp,
            "vector_ids": []
        }
        
        if authors:
            item["authors"] = authors
        if abstract:
            item["abstract"] = abstract
        
        self.papers_table.put_item(Item=item)
        return item
    
    def get_paper(self, user_id: str, document_id: str) -> Optional[Dict]:
        """Get a paper by user_id and document_id."""
        response = self.papers_table.get_item(
            Key={"user_id": user_id, "document_id": document_id}
        )
        return response.get("Item")
    
    def get_paper_by_id(self, document_id: str) -> Optional[Dict]:
        """Get a paper by document_id only (scans table)."""
        response = self.papers_table.scan(
            FilterExpression=Attr("document_id").eq(document_id)
        )
        items = response.get("Items", [])
        return items[0] if items else None
    
    def list_user_papers(self, user_id: str, status: Optional[str] = None) -> List[Dict]:
        """List all papers for a user."""
        key_condition = Key("user_id").eq(user_id)
        
        if status:
            response = self.papers_table.query(
                KeyConditionExpression=key_condition,
                FilterExpression=Attr("status").eq(status)
            )
        else:
            response = self.papers_table.query(
                KeyConditionExpression=key_condition
            )
        
        return response.get("Items", [])
    
    def update_paper_status(
        self,
        user_id: str,
        document_id: str,
        status: str,
        vector_ids: Optional[List[str]] = None
    ) -> Dict:
        """Update paper processing status."""
        update_expr = "SET #status = :status, updated_at = :updated_at"
        expr_values = {
            ":status": status,
            ":updated_at": int(time.time())
        }
        expr_names = {"#status": "status"}
        
        if vector_ids is not None:
            update_expr += ", vector_ids = :vector_ids"
            expr_values[":vector_ids"] = vector_ids
        
        response = self.papers_table.update_item(
            Key={"user_id": user_id, "document_id": document_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
            ReturnValues="ALL_NEW"
        )
        
        return response.get("Attributes", {})
    
    def update_paper_metadata(
        self,
        user_id: str,
        document_id: str,
        **kwargs
    ) -> Dict:
        """Update paper metadata fields (title, authors, abstract, etc.)."""
        if not kwargs:
            return {}
        
        # Build update expression dynamically
        update_parts = []
        expr_values = {":updated_at": int(time.time())}
        expr_names = {}
        
        for key, value in kwargs.items():
            if value is not None:  # Only update non-None values
                placeholder = f":{key}"
                attr_name = f"#{key}"
                update_parts.append(f"{attr_name} = {placeholder}")
                expr_values[placeholder] = value
                expr_names[attr_name] = key
        
        if not update_parts:
            return {}
        
        update_expr = "SET " + ", ".join(update_parts) + ", updated_at = :updated_at"
        
        response = self.papers_table.update_item(
            Key={"user_id": user_id, "document_id": document_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
            ReturnValues="ALL_NEW"
        )
        
        return response.get("Attributes", {})
    
    def delete_paper(self, user_id: str, document_id: str):
        """Delete a paper."""
        self.papers_table.delete_item(
            Key={"user_id": user_id, "document_id": document_id}
        )
    
    # ==================== Study Sessions Operations ====================
    
    def create_session(
        self,
        user_id: str,
        name: str,
        paper_ids: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new study session.
        
        Args:
            user_id: Owner user ID
            name: Session name
            paper_ids: List of document IDs to include
            
        Returns:
            Created session item
        """
        session_id = str(uuid.uuid4())
        timestamp = int(time.time())
        iso_timestamp = datetime.fromtimestamp(timestamp).isoformat()
        
        item = {
            "user_id": user_id,
            "session_id": session_id,
            "name": name,
            "paper_ids": paper_ids or [],
            "created_at": timestamp,
            "last_active": iso_timestamp  # GSI expects string format
        }
        
        self.sessions_table.put_item(Item=item)
        return item
    
    def get_session(self, user_id: str, session_id: str) -> Optional[Dict]:
        """Get a study session."""
        response = self.sessions_table.get_item(
            Key={"user_id": user_id, "session_id": session_id}
        )
        return response.get("Item")
    
    def list_user_sessions(self, user_id: str) -> List[Dict]:
        """List all sessions for a user."""
        response = self.sessions_table.query(
            KeyConditionExpression=Key("user_id").eq(user_id)
        )
        return response.get("Items", [])
    
    def update_session(
        self,
        user_id: str,
        session_id: str,
        name: Optional[str] = None,
        paper_ids: Optional[List[str]] = None
    ) -> Dict:
        """Update a study session."""
        update_parts = ["last_active = :last_active"]
        expr_values = {":last_active": datetime.now().isoformat()}
        
        if name is not None:
            update_parts.append("#name = :name")
            expr_values[":name"] = name
        
        if paper_ids is not None:
            update_parts.append("paper_ids = :paper_ids")
            expr_values[":paper_ids"] = paper_ids
        
        update_expr = "SET " + ", ".join(update_parts)
        expr_names = {"#name": "name"} if name is not None else None
        
        kwargs = {
            "Key": {"user_id": user_id, "session_id": session_id},
            "UpdateExpression": update_expr,
            "ExpressionAttributeValues": expr_values,
            "ReturnValues": "ALL_NEW"
        }
        if expr_names:
            kwargs["ExpressionAttributeNames"] = expr_names
        
        response = self.sessions_table.update_item(**kwargs)
        return response.get("Attributes", {})
    
    def add_paper_to_session(self, user_id: str, session_id: str, document_id: str) -> Dict:
        """Add a paper to a study session."""
        response = self.sessions_table.update_item(
            Key={"user_id": user_id, "session_id": session_id},
            UpdateExpression="SET paper_ids = list_append(if_not_exists(paper_ids, :empty), :paper_id), last_active = :last_active",
            ExpressionAttributeValues={
                ":paper_id": [document_id],
                ":empty": [],
                ":last_active": datetime.now().isoformat()
            },
            ReturnValues="ALL_NEW"
        )
        return response.get("Attributes", {})
    
    def remove_paper_from_session(self, user_id: str, session_id: str, document_id: str) -> Dict:
        """Remove a paper from a study session."""
        session = self.get_session(user_id, session_id)
        if not session:
            return {}
        
        paper_ids = session.get("paper_ids", [])
        if document_id in paper_ids:
            paper_ids.remove(document_id)
        
        return self.update_session(user_id, session_id, paper_ids=paper_ids)
    
    def delete_session(self, user_id: str, session_id: str):
        """Delete a study session."""
        self.sessions_table.delete_item(
            Key={"user_id": user_id, "session_id": session_id}
        )
    
    # ==================== Chat History Operations ====================
    
    def add_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Add a message to chat history.
        
        Args:
            session_id: Study session ID
            role: "user" or "assistant"
            content: Message content
            sources: List of source citations for assistant messages
            
        Returns:
            Created message item
        """
        # Use ISO timestamp string - DynamoDB schema expects String type
        timestamp = datetime.now().isoformat()
        
        item = {
            "session_id": session_id,
            "timestamp": timestamp,
            "role": role,
            "content": content
        }
        
        if sources:
            item["sources"] = sources
        
        self.chat_table.put_item(Item=item)
        return item
    
    def get_chat_history(
        self,
        session_id: str,
        limit: int = 50
    ) -> List[Dict]:
        """Get chat history for a session."""
        response = self.chat_table.query(
            KeyConditionExpression=Key("session_id").eq(session_id),
            ScanIndexForward=True,  # Oldest first
            Limit=limit
        )
        return response.get("Items", [])
    
    def clear_chat_history(self, session_id: str):
        """Delete all chat messages for a session."""
        messages = self.get_chat_history(session_id, limit=1000)
        
        with self.chat_table.batch_writer() as batch:
            for msg in messages:
                batch.delete_item(
                    Key={
                        "session_id": msg["session_id"],
                        "timestamp": msg["timestamp"]
                    }
                )
    
    # ==================== Paper Insights Operations ====================
    
    def save_paper_insights(
        self,
        user_id: str,
        document_id: str,
        insights: Dict
    ) -> Dict:
        """
        Save paper insights (NLP analysis + methodology flowchart).
        
        Args:
            user_id: Owner user ID
            document_id: Document ID
            insights: Insights data from PaperInsightsGenerator
            
        Returns:
            Updated paper item
        """
        # Convert any floats to Decimal for DynamoDB
        insights_decimal = self._convert_floats_to_decimal(insights)
        
        response = self.papers_table.update_item(
            Key={"user_id": user_id, "document_id": document_id},
            UpdateExpression="SET insights = :insights, updated_at = :updated_at",
            ExpressionAttributeValues={
                ":insights": insights_decimal,
                ":updated_at": int(time.time())
            },
            ReturnValues="ALL_NEW"
        )
        
        return response.get("Attributes", {})
    
    def get_paper_insights(self, user_id: str, document_id: str) -> Optional[Dict]:
        """
        Get paper insights.
        
        Args:
            user_id: Owner user ID
            document_id: Document ID
            
        Returns:
            Insights data or None if not available
        """
        paper = self.get_paper(user_id, document_id)
        if paper and "insights" in paper:
            return paper["insights"]
        return None
    
    def _convert_floats_to_decimal(self, obj: Any) -> Any:
        """Recursively convert floats to Decimal for DynamoDB storage."""
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._convert_floats_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_floats_to_decimal(item) for item in obj]
        return obj


# Singleton instance for convenience
_db_client = None

def get_db_client() -> DynamoDBClient:
    """Get singleton DynamoDB client."""
    global _db_client
    if _db_client is None:
        _db_client = DynamoDBClient()
    return _db_client




