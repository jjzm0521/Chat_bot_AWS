"""
Script para poblar la base de datos DynamoDB con datos iniciales.
Ejecutar: python scripts/seed-database.py
"""

import json
import boto3
from pathlib import Path
import sys

# Configuracion
REGION = 'us-east-1'
KNOWLEDGE_BASE_TABLE = 'ChatbotKnowledgeBase'

def load_faqs():
    """Cargar FAQs desde archivo JSON."""
    faq_path = Path(__file__).parent.parent / 'data' / 'knowledge_base' / 'faqs.json'
    
    if not faq_path.exists():
        print(f"ERROR: Archivo no encontrado: {faq_path}")
        sys.exit(1)
    
    with open(faq_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    return data.get('faqs', [])


def seed_knowledge_base(dynamodb, faqs):
    """Insertar FAQs en la tabla de Knowledge Base."""
    table = dynamodb.Table(KNOWLEDGE_BASE_TABLE)
    
    print(f"\nInsertando {len(faqs)} FAQs en {KNOWLEDGE_BASE_TABLE}...")
    
    for faq in faqs:
        item = {
            'PK': f"FAQ#{faq['category']}",
            'SK': f"TOPIC#{faq['topic_id']}",
            'category': faq['category'],
            'question_es': faq['question_es'],
            'question_en': faq['question_en'],
            'question_pt': faq['question_pt'],
            'answer_es': faq['answer_es'],
            'answer_en': faq['answer_en'],
            'answer_pt': faq['answer_pt'],
            'keywords': faq['keywords'],
        }
        
        try:
            table.put_item(Item=item)
            print(f"  OK: {faq['category']}/{faq['topic_id']}")
        except Exception as e:
            print(f"  ERROR insertando {faq['topic_id']}: {e}")
    
    print(f"\n{len(faqs)} FAQs insertadas correctamente")


def main():
    print("=" * 50)
    print("  Chatbot AWS - Seed Database")
    print("=" * 50)
    
    # Verificar conexion a AWS
    try:
        dynamodb = boto3.resource('dynamodb', region_name=REGION)
        # Test connection
        dynamodb.meta.client.describe_table(TableName=KNOWLEDGE_BASE_TABLE)
        print(f"\nConectado a DynamoDB en {REGION}")
    except Exception as e:
        print(f"\nError conectando a DynamoDB: {e}")
        print("\nAsegurate de:")
        print("  1. Tener AWS CLI configurado (aws configure)")
        print("  2. Haber desplegado la infraestructura (./scripts/deploy.ps1)")
        sys.exit(1)
    
    # Cargar y seed FAQs
    faqs = load_faqs()
    seed_knowledge_base(dynamodb, faqs)
    
    print("\n" + "=" * 50)
    print("  Base de datos poblada exitosamente")
    print("=" * 50)


if __name__ == '__main__':
    main()
