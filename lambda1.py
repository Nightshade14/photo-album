import json
import boto3
import os
from datetime import datetime
from opensearchpy import OpenSearch, RequestsHttpConnection, OpenSearchException
from requests_aws4auth import AWS4Auth
from pprint import pprint
import base64

def get_awsauth(region):
    credentials = boto3.Session().get_credentials()
    return AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        region,
        'es',
        session_token=credentials.token
    )

def create_opensearch_client():
    host = os.environ['ES_HOST']  # OpenSearch domain endpoint
    region = os.environ['AWS_REGION1']
    auth = get_awsauth(region)
    
    return OpenSearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )

def detect_labels(bucket, key):
    rekognition = boto3.client('rekognition')
    try:
        response = rekognition.detect_labels(
            Image={
                'S3Object': {
                    'Bucket': bucket,
                    'Name': key
                }
            },
            MaxLabels=10,
            MinConfidence=90
        )
        return [label['Name'].lower() for label in response['Labels']]
    except Exception as e:
        print(f"Error detecting labels: {str(e)}")
        raise

def get_custom_labels(bucket, key):
    s3 = boto3.client('s3')
    try:
        metadata = s3.head_object(Bucket=bucket, Key=key)
        custom_labels = metadata.get('Metadata', {}).get('customLabels', '')
        if custom_labels:
            return [label.strip().lower() for label in custom_labels.split(',')]
        return []
    except Exception as e:
        print(f"Error getting custom labels: {str(e)}")
        return []

def index_photo(client, photo_object):
    try:
        response = client.index(
            index='photos',
            body=photo_object,
            refresh=True
        )
        return response
    except OpenSearchException as e:
        print(f"OpenSearch indexing error: {str(e)}")
        raise

def lambda_handler(event, context):
    try:
        # Extract S3 information
        record = event['Records'][0]['s3']
        bucket = record['bucket']['name']
        key = record['object']['key']
        
        # Get image labels from Rekognition
        rekognition_labels = detect_labels(bucket, key)
        
        # Get custom labels from S3 metadata
        custom_labels = get_custom_labels(bucket, key)
        
        # Combine all labels
        all_labels = list(set(rekognition_labels + custom_labels))
        
        # Create photo object
        photo_object = {
            'objectKey': key,
            'bucket': bucket,
            'createdTimestamp': datetime.now().isoformat(),
            'labels': all_labels
        }
        
        # Index in OpenSearch
        opensearch_client = create_opensearch_client()
        index_response = index_photo(opensearch_client, photo_object)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Photo indexed successfully',
                'photo': photo_object
            })
        }
        
    except Exception as e:
        print(f"Error processing photo: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'message': 'Error processing photo',
                'error': str(e)
            })
        }