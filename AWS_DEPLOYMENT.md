# Deploy WearForward on AWS

This repository is a monorepo: the Vite frontend is in `Code/frontend` and the Express API is in `Code/backend`. The API uses PostgreSQL, Knex migrations, JWTs, and a configurable image store. For AWS, use a private S3 bucket with CloudFront in front of it.

## Suggested AWS layout

- **AWS Amplify Hosting** serves the Vite frontend and provides HTTPS.
- **Amazon ECS Express Mode on Fargate** runs the API from an image in ECR and provides an HTTPS endpoint.
- **Amazon RDS for PostgreSQL** stores application data; keep it private and allow port 5432 only from the API's security group.
- **AWS Secrets Manager** stores the database URL and JWT secret. The API receives S3 write access through its ECS task role, without static AWS keys.
- **Amazon S3 + CloudFront** stores donation images privately and serves them over HTTPS through an Origin Access Control (OAC).

App Runner is no longer available to new AWS customers as of April 30, 2026. AWS recommends ECS Express Mode as its simpler managed container alternative. ECS Express Mode itself has no additional charge; the underlying Fargate, load balancer, logging, database, and data transfer resources are billed. Set a budget alert before provisioning.

## Before creating resources

1. Push this repository to a private GitHub repository. Do not commit `.env` files or credentials.
2. Sign into AWS with an IAM Identity Center user and MFA, not the root user. Choose one AWS Region for Amplify, ECR, ECS, and RDS (for example, `ap-south-1` for India).
3. Configure an AWS Budget alert. RDS and the load balancer can continue to incur charges while idle.
4. Create an S3 bucket for donation images and a CloudFront distribution with OAC. Local disk uploads are not durable across container replacement or scaling.

## Deploy the frontend

1. In **AWS Amplify Hosting**, create an app from the GitHub repository and select the `main` branch. Choose the monorepo app root `Code/frontend`.
2. The repository's root `amplify.yml` builds the app to `Code/frontend/dist`.
3. Add an Amplify rewrite from `/<*>` to `/index.html` with status `200`, so direct visits to React Router pages work.
4. Deploy once and note the HTTPS Amplify domain. The API URL can be set after the backend is deployed.

## Create the database

1. Create an RDS PostgreSQL instance in the same Region and VPC as the API. Keep **Public access** disabled.
2. Create a database security group that accepts TCP 5432 only from the API service security group. Do not open PostgreSQL to `0.0.0.0/0`.
3. Store the RDS connection string in Secrets Manager as `DATABASE_URL`; use the RDS endpoint, database name, and URL-encoded credentials. Require TLS for PostgreSQL connections.
4. Store a long random value for `JWT_SECRET` in Secrets Manager.

## Configure private image storage

1. Create a general-purpose S3 bucket in the same Region as the API. Keep **Block all public access** enabled and Object Ownership set to **Bucket owner enforced**. Enable default server-side encryption.
2. Create a CloudFront distribution with this bucket as an S3 origin. Configure an Origin Access Control (OAC) to **Sign requests (recommended)**. Do not use an S3 website endpoint.
3. Add a bucket policy granting `s3:GetObject` to the CloudFront service principal, scoped with `AWS:SourceArn` to the exact distribution ARN. Keep Block Public Access enabled. CloudFront OAC keeps S3 objects private while serving them over HTTPS. See [AWS's OAC setup](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).
4. Give the ECS task role only `s3:PutObject` on `arn:aws:s3:::YOUR_BUCKET/uploads/*`. The Node.js AWS SDK uses the ECS task role credential provider; do not put access keys in environment variables. See [AWS SDK credential providers](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).
5. Configure the API with `IMAGE_STORAGE_DRIVER=s3`, `AWS_REGION`, `S3_BUCKET_NAME`, and `S3_PUBLIC_BASE_URL=https://YOUR_DISTRIBUTION_DOMAIN`. The returned image URLs use CloudFront; the bucket itself remains private.

## Build and publish the API image (PowerShell)

Install and sign into Docker Desktop, install the AWS CLI, then configure AWS access with IAM Identity Center (`aws configure sso`). Replace the Region if needed:

```powershell
$region = 'ap-south-1'
$repository = 'wearforward-api'
$accountId = aws sts get-caller-identity --query Account --output text
$imageUri = "$accountId.dkr.ecr.$region.amazonaws.com/$repository"

aws ecr create-repository --repository-name $repository --region $region
aws ecr get-login-password --region $region | docker login --username AWS --password-stdin "$accountId.dkr.ecr.$region.amazonaws.com"
docker build --platform linux/amd64 -f Code/backend/Dockerfile -t $repository Code/backend
docker tag "${repository}:latest" "${imageUri}:latest"
docker push "${imageUri}:latest"
```

## Run the API on ECS Express Mode

1. In the Amazon ECS console, create an **Express Mode** service from the ECR image. Use container port `4000` and health check path `/health`.
2. Use a public HTTPS endpoint for the API. Keep the RDS instance private; configure the ECS task's security group to reach RDS on 5432.
3. Set `NODE_ENV=production`, `PORT=4000`, `IMAGE_STORAGE_DRIVER=s3`, `AWS_REGION`, `S3_BUCKET_NAME`, `S3_PUBLIC_BASE_URL`, `CLAIM_EXPIRY_JOB_INTERVAL_MS=300000`, and `DATABASE_POOL_MAX=10` as service environment variables. Set `DATABASE_URL` and `JWT_SECRET` as Secrets Manager references, not plain-text values. Attach the least-privilege S3 upload policy to the ECS task role.
4. Set `CORS_ALLOWED_ORIGINS` to the exact Amplify origin (for example, `https://main.xxxxx.amplifyapp.com`, with no trailing slash), and `FRONTEND_BASE_URL` to that origin.
5. Run Knex migrations once, before sending traffic: start a one-off ECS task from the same image in the service VPC with command `npx knex migrate:latest --env production`. Confirm it exits successfully. Do not run development seeds in production.
6. Copy the ECS HTTPS URL. In Amplify, set `VITE_API_BASE_URL` to that URL with no trailing slash, then redeploy the frontend.

## Verify

- Open `https://<api-url>/health`; expect `{"status":"ok"}`.
- Open the Amplify HTTPS site, refresh a nested route, and test donor sign-in, creating a listing with an image, NGO claim/pickup/distribution, and admin pages.
- Check CloudWatch logs for the API and confirm uploads return HTTPS CloudFront URLs while direct S3 object URLs remain private.

## Current app limitation before public launch

Password reset delivery is a development stub that writes messages to the backend console. In production the API intentionally does not return the reset secret, so users cannot complete password recovery until a real email delivery provider is connected. Configure and verify that workflow before inviting users. Also confirm any real-world NGO verification provider you need; the current provider settings are optional placeholders.

## Existing local data

Knex migrations create/update the schema; they do not copy local PostgreSQL records. If you need to preserve current local users or donations, plan a separate, tested `pg_dump`/restore before switching users to production. Do not point the local app or tests at the production database.
