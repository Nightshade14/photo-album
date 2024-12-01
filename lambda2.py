import json
import boto3
import os
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

def get_slots(lex_response):
    slots = []
    if 'sessionState' in lex_response and 'intent' in lex_response['sessionState']:
        intent_slots = lex_response['sessionState']['intent'].get('slots', {})
        for slot_value in intent_slots.values():
            if slot_value and 'value' in slot_value:
                interpreted_value = slot_value['value'].get('interpretedValue')
                if interpreted_value:
                    slots.append(interpreted_value.lower())
    return slots

def search_photos(keywords):
    # Get environment variables
    host = os.environ['ES_HOST']
    region = os.environ['AWS_REGION1']
    
    # Get credentials
    credentials = boto3.Session().get_credentials()
    auth = AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        region,
        'es',
        session_token=credentials.token
    )
    
    client = OpenSearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )
    
    query = {
        "query": {
            "terms": {
                "labels": keywords
            }
        }
    }
    
    response = client.search(
        index="photos",
        body=query
    )
    
    return response['hits']['hits']

def lambda_handler(event, context):
    query = event.get('queryStringParameters', {}).get('q', '')
    
    # Get Lex configuration from environment variables
    bot_id = os.environ['BOT_ID']
    bot_alias_id = os.environ['BOT_ALIAS_ID']
    
    lex = boto3.client('lexv2-runtime')
    lex_response = lex.recognize_text(
        botId=bot_id,
        botAliasId=bot_alias_id,
        localeId='en_US',
        sessionId='test-session',
        text=query
    )
    
    keywords = get_slots(lex_response)
    
    if keywords:
        results = search_photos(keywords)
    else:
        results = []
    
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'results': results})
    }