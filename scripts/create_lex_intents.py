# -*- coding: utf-8 -*-
"""
Script para crear intents en Amazon Lex v2.
Ejecutar con: python scripts/create_lex_intents.py
"""

import boto3
import sys

# Fix encoding para Windows
sys.stdout.reconfigure(encoding='utf-8')

# Configuracion del bot
BOT_ID = 'X3ADVBRCTQ'
BOT_VERSION = 'DRAFT'
LOCALE_ID = 'es_ES'
REGION = 'us-east-1'

# Cliente Lex
lex = boto3.client('lexv2-models', region_name=REGION)

# ============ DEFINICIONES DE INTENTS ============

INTENTS = [
    {
        'intentName': 'GreetingIntent',
        'description': 'Maneja saludos del usuario',
        'sampleUtterances': [
            {'utterance': 'hola'},
            {'utterance': 'buenos dias'},
            {'utterance': 'buenas tardes'},
            {'utterance': 'buenas noches'},
            {'utterance': 'que tal'},
            {'utterance': 'hey'},
            {'utterance': 'saludos'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Hola! Soy tu asistente virtual. En que puedo ayudarte hoy? Puedo responder preguntas sobre precios, envios, devoluciones, garantia y horarios.'
                        }
                    }
                }]
            },
            'active': True
        }
    },
    {
        'intentName': 'FarewellIntent',
        'description': 'Maneja despedidas del usuario',
        'sampleUtterances': [
            {'utterance': 'adios'},
            {'utterance': 'hasta luego'},
            {'utterance': 'chao'},
            {'utterance': 'nos vemos'},
            {'utterance': 'bye'},
            {'utterance': 'hasta pronto'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Hasta luego! Fue un placer ayudarte. Que tengas un excelente dia!'
                        }
                    }
                }]
            },
            'active': True
        }
    },
    {
        'intentName': 'HelpIntent',
        'description': 'Proporciona ayuda al usuario',
        'sampleUtterances': [
            {'utterance': 'ayuda'},
            {'utterance': 'que puedes hacer'},
            {'utterance': 'como funciona'},
            {'utterance': 'opciones'},
            {'utterance': 'comandos'},
            {'utterance': 'necesito ayuda'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Puedo ayudarte con consultas sobre: precios de productos, politicas de envio, devoluciones, garantias, horarios de atencion y formas de contacto. Sobre que tema te gustaria saber?'
                        }
                    }
                }]
            },
            'active': True
        }
    },
    {
        'intentName': 'PriceQueryIntent',
        'description': 'Consultas sobre precios',
        'sampleUtterances': [
            {'utterance': 'cuanto cuesta'},
            {'utterance': 'precio'},
            {'utterance': 'precios'},
            {'utterance': 'cual es el precio'},
            {'utterance': 'informacion sobre precios'},
            {'utterance': 'costo'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Nuestros precios varian segun el producto. Puedes consultar nuestro catalogo en linea para ver los precios actualizados. Tambien ofrecemos descuentos especiales para compras al por mayor.'
                        }
                    }
                }]
            },
            'active': True
        }
    },
    {
        'intentName': 'ShippingQueryIntent',
        'description': 'Consultas sobre envios',
        'sampleUtterances': [
            {'utterance': 'envio'},
            {'utterance': 'envios'},
            {'utterance': 'como envian'},
            {'utterance': 'cuanto tarda el envio'},
            {'utterance': 'informacion sobre envios'},
            {'utterance': 'delivery'},
            {'utterance': 'despacho'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Realizamos envios a todo el pais. El tiempo de entrega es de 3-5 dias habiles para zonas urbanas y 5-7 dias para zonas rurales. El costo de envio se calcula segun el peso y destino.'
                        }
                    }
                }]
            },
            'active': True
        }
    },
    {
        'intentName': 'ReturnQueryIntent',
        'description': 'Consultas sobre devoluciones',
        'sampleUtterances': [
            {'utterance': 'devolucion'},
            {'utterance': 'devoluciones'},
            {'utterance': 'quiero devolver'},
            {'utterance': 'politica de devolucion'},
            {'utterance': 'reembolso'},
            {'utterance': 'cambio de producto'},
        ],
        'intentClosingSetting': {
            'closingResponse': {
                'messageGroups': [{
                    'message': {
                        'plainTextMessage': {
                            'value': 'Aceptamos devoluciones dentro de los 30 dias posteriores a la compra, siempre que el producto este en su empaque original y sin uso. El reembolso se procesa en 5-7 dias habiles.'
                        }
                    }
                }]
            },
            'active': True
        }
    },
]


def create_intent(intent_config):
    """Crear un intent en el bot de Lex."""
    try:
        response = lex.create_intent(
            botId=BOT_ID,
            botVersion=BOT_VERSION,
            localeId=LOCALE_ID,
            intentName=intent_config['intentName'],
            description=intent_config.get('description', ''),
            sampleUtterances=intent_config.get('sampleUtterances', []),
            intentClosingSetting=intent_config.get('intentClosingSetting'),
        )
        print(f"[OK] Intent '{intent_config['intentName']}' creado exitosamente")
        return response
    except lex.exceptions.ConflictException:
        print(f"[WARN] Intent '{intent_config['intentName']}' ya existe, actualizando...")
        return update_intent(intent_config)
    except Exception as e:
        print(f"[ERROR] Error creando intent '{intent_config['intentName']}': {e}")
        return None


def update_intent(intent_config):
    """Actualizar un intent existente."""
    try:
        # Primero obtener el intent para tener el ID
        intents = lex.list_intents(
            botId=BOT_ID,
            botVersion=BOT_VERSION,
            localeId=LOCALE_ID,
        )
        
        intent_id = None
        for intent in intents.get('intentSummaries', []):
            if intent['intentName'] == intent_config['intentName']:
                intent_id = intent['intentId']
                break
        
        if not intent_id:
            print(f"[ERROR] No se encontro el intent '{intent_config['intentName']}'")
            return None
        
        response = lex.update_intent(
            botId=BOT_ID,
            botVersion=BOT_VERSION,
            localeId=LOCALE_ID,
            intentId=intent_id,
            intentName=intent_config['intentName'],
            description=intent_config.get('description', ''),
            sampleUtterances=intent_config.get('sampleUtterances', []),
            intentClosingSetting=intent_config.get('intentClosingSetting'),
        )
        print(f"[OK] Intent '{intent_config['intentName']}' actualizado exitosamente")
        return response
    except Exception as e:
        print(f"[ERROR] Error actualizando intent '{intent_config['intentName']}': {e}")
        return None


def build_bot_locale():
    """Construir el locale del bot despues de crear los intents."""
    try:
        response = lex.build_bot_locale(
            botId=BOT_ID,
            botVersion=BOT_VERSION,
            localeId=LOCALE_ID,
        )
        print(f"\n[BUILD] Construccion del bot iniciada...")
        return response
    except Exception as e:
        print(f"[ERROR] Error construyendo el bot: {e}")
        return None


def main():
    print(f"\n{'='*50}")
    print(f"Creando intents para bot {BOT_ID}")
    print(f"Locale: {LOCALE_ID}")
    print(f"{'='*50}\n")
    
    # Crear todos los intents
    for intent in INTENTS:
        create_intent(intent)
    
    print(f"\n{'='*50}")
    print("Intents creados. Construyendo el bot...")
    print(f"{'='*50}\n")
    
    # Construir el bot
    build_bot_locale()
    
    print("\n[DONE] Proceso completado.")
    print("Nota: La construccion del bot puede tardar unos minutos.")
    print("Verifica el estado en la consola de Amazon Lex.")


if __name__ == '__main__':
    main()
