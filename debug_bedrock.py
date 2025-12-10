import boto3
import json
import os

def test_bedrock():
    print("Testing Bedrock Connection...")
    
    # Check credentials
    session = boto3.Session()
    credentials = session.get_credentials()
    if not credentials:
        print("ERROR: No AWS credentials found.")
        return

    print(f"Using Region: {session.region_name}")
    print(f"Access Key: {credentials.access_key}")
    
    bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
    
    # Try with Titan first (often enabled)
    models_to_test = [
        'anthropic.claude-v2',
        'amazon.titan-text-express-v1',
    ]
    
    for model_id in models_to_test:
        print(f"\nAttempting to invoke: {model_id}")
        try:
            prompt = "Human: Hello, are you working?\n\nAssistant:"
            body = {
                "prompt": prompt,
                "max_tokens_to_sample": 50,
            } if 'claude' in model_id else {
                "inputText": "Hello, are you working?",
                "textGenerationConfig": {
                    "maxTokenCount": 50
                }
            }
            
            response = bedrock.invoke_model(
                modelId=model_id,
                body=json.dumps(body),
                contentType='application/json',
                accept='application/json'
            )
            
            print(f"SUCCESS with {model_id}")
            print(response['body'].read())
            return # Stop after first success
            
        except Exception as e:
            print(f"FAILED with {model_id}")
            print(f"Error: {e}")

if __name__ == "__main__":
    test_bedrock()
