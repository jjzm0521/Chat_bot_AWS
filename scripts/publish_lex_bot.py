# -*- coding: utf-8 -*-
"""
Script para publicar bot de Lex y actualizar alias
"""
import boto3

BOT_ID = 'X3ADVBRCTQ'
ALIAS_ID = '9VQMVYGAGE'
REGION = 'us-east-1'

lex = boto3.client('lexv2-models', region_name=REGION)

# 1. Crear nueva version del bot
print("Creando nueva version del bot...")
try:
    version_response = lex.create_bot_version(
        botId=BOT_ID,
        botVersionLocaleSpecification={
            'es_ES': {'sourceBotVersion': 'DRAFT'}
        }
    )
    new_version = version_response.get('botVersion')
    print(f"Nueva version creada: {new_version}")
except Exception as e:
    print(f"Error creando version: {e}")
    exit(1)

# 2. Esperar a que la version este disponible
import time
print("Esperando a que la version este disponible...")
for _ in range(30):
    try:
        status = lex.describe_bot_version(
            botId=BOT_ID,
            botVersion=new_version
        )
        if status['botStatus'] == 'Available':
            print("Version disponible!")
            break
        print(f"Estado: {status['botStatus']}...")
        time.sleep(5)
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)

# 3. Actualizar alias para usar nueva version
print(f"Actualizando alias {ALIAS_ID} para usar version {new_version}...")
try:
    alias_response = lex.update_bot_alias(
        botId=BOT_ID,
        botAliasId=ALIAS_ID,
        botAliasName='Production',
        botVersion=new_version,
        botAliasLocaleSettings={
            'es_ES': {
                'enabled': True
            }
        }
    )
    print("Alias actualizado exitosamente!")
except Exception as e:
    print(f"Error actualizando alias: {e}")

print("Proceso completado!")
