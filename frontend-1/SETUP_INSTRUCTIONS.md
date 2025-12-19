# Frontend Setup Instructions

## 1. Environment Variables

Create a `.env.local` file in the `frontend-1` directory with the following variables:

```bash
# AWS Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id-here
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id-here
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_AWS_REGION=us-east-1

# API Gateway URL
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
```

### How to Get These Values:

1. **From CloudFormation Stack Outputs:**
   ```bash
   aws cloudformation describe-stacks --stack-name <your-stack-name> --query "Stacks[0].Outputs"
   ```
   
   Look for:
   - `CognitoUserPoolId` → `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
   - `CognitoUserPoolClientId` → `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - `CognitoDomain` → `NEXT_PUBLIC_COGNITO_DOMAIN`
   - `ApiEndpoint` → `NEXT_PUBLIC_API_URL`

2. **From AWS Console:**
   - Cognito: AWS Console → Cognito → User Pools → Your Pool → App Integration
   - API Gateway: AWS Console → API Gateway → Your API → Stages → dev

## 2. Testing Insights/Flowchart

If you see "No methodology flowchart available":

1. **Check if insights exist:**
   - Papers processed BEFORE insights feature was added won't have insights
   - You need to reprocess or re-upload those papers

2. **Test the API endpoint directly:**
   ```bash
   curl "https://your-api-url/papers/{document_id}/insights?user_id={your_user_id}" \
     -H "Authorization: Bearer {your-id-token}"
   ```

3. **Check Lambda logs:**
   - Look at `paper-processor` Lambda logs for errors during insights generation
   - Check if Comprehend and Bedrock permissions are correct

4. **Reprocess a paper:**
   - Upload a new paper OR
   - Trigger reprocessing via SQS (if you have that capability)

## 3. Running the Frontend

```bash
cd frontend-1
npm install
npm run dev
```

The app will be available at `http://localhost:3000`

## 5. Building for Production

```bash
npm run build
npm start
```

