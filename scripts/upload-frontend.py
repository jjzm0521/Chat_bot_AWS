"""
Script para subir el frontend a S3.
"""
import boto3
import os
import mimetypes

# Configuración
BUCKET_NAME = 'chatbot-frontend-655765967000-us-east-1'
DIST_DIR = 'frontend/dist'

def get_content_type(filepath):
    """Obtener el content type correcto para el archivo."""
    content_type, _ = mimetypes.guess_type(filepath)
    if content_type is None:
        content_type = 'application/octet-stream'
    return content_type

def upload_directory(local_dir, bucket):
    """Subir un directorio completo a S3."""
    s3 = boto3.client('s3')
    
    for root, dirs, files in os.walk(local_dir):
        for file in files:
            local_path = os.path.join(root, file)
            # Obtener path relativo para S3
            s3_key = os.path.relpath(local_path, local_dir).replace('\\', '/')
            
            content_type = get_content_type(local_path)
            
            print(f"Subiendo: {s3_key} ({content_type})")
            s3.upload_file(
                local_path,
                bucket,
                s3_key,
                ExtraArgs={'ContentType': content_type}
            )
    
    print(f"\n✓ Frontend subido exitosamente a s3://{bucket}")
    print(f"✓ URL: https://d27rk2puv32emi.cloudfront.net")

if __name__ == '__main__':
    upload_directory(DIST_DIR, BUCKET_NAME)
