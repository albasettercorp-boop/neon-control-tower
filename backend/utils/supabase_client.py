"""
Supabase Client
Wrapper для работы с Supabase
"""

import os
import json
from typing import Dict, List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()


class SupabaseClient:
    """Клиент для работы с Supabase"""

    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")

        if not url or not key:
            raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть в .env")

        self.client: Client = create_client(url, key)

    def get_lead(self, lead_id: str) -> Optional[Dict]:
        """Получить лида по ID"""
        response = self.client.table('sellers').select('*').eq('id', lead_id).execute()
        return response.data[0] if response.data else None

    def get_leads_by_status(self, status: str) -> List[Dict]:
        """Получить лидов по статусу"""
        response = self.client.table('sellers').select('*').eq('funnel_stage', status).execute()
        return response.data

    def insert_lead(self, lead_data: Dict) -> Dict:
        """Добавить нового лида"""
        response = self.client.table('sellers').insert(lead_data).execute()
        return response.data[0]

    def update_lead(self, lead_id: str, update_data: Dict) -> Dict:
        """Обновить лида"""
        response = self.client.table('sellers').update(update_data).eq('id', lead_id).execute()
        return response.data[0]

    def check_duplicate_inn(self, inn: str) -> bool:
        """Проверить дубликат по ИНН"""
        response = self.client.table('sellers').select('id').eq('inn', inn).execute()
        return len(response.data) > 0

    def add_conversation_message(self, seller_id: str, message_text: str,
                                 sender: str, channel: str,
                                 intent: Optional[str] = None,
                                 sentiment_score: Optional[float] = None) -> Dict:
        """Добавить сообщение в conversations"""
        data = {
            'seller_id': seller_id,
            'message_text': message_text,
            'sender': sender,
            'channel': channel,
            'intent': intent,
            'sentiment_score': sentiment_score
        }
        response = self.client.table('conversations').insert(data).execute()
        return response.data[0]

    def get_conversations(self, seller_id: str, limit: int = 10) -> List[Dict]:
        """Получить историю диалога"""
        response = (self.client.table('conversations')
                   .select('*')
                   .eq('seller_id', seller_id)
                   .order('timestamp', desc=True)
                   .limit(limit)
                   .execute())
        return list(reversed(response.data))
