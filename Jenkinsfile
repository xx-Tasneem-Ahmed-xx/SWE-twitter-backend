pipeline {
    agent { label 'jenkins-agent' }
    
    environment {
        DOCKER_IMAGE = "realshoy/swe-backend"
        BUILD_TAG = "${env.BUILD_NUMBER}"
        DOCKER_REGISTRY_CREDENTIALS = 'dockerhub-credentials' 
        KUBE_CONFIG_CREDENTIALS = 'kubeconfig-file'
        BACKEND_SECRET_FILE = 'backend-secret-file'  
        EMAIL_RECIPIENTS = 'asxcchcv@gmail.com'
        GIT_CREDENTIALS = 'github-token'
        DATABASE_URL = credentials('my-db-url') 
    }
    
    stages {
        stage("SCM Checkout") {
            steps {
                script {
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/main']],
                        userRemoteConfigs: [[
                            url: 'https://github.com/CUFE-Software-Engineering-Project/SWE-twitter-backend.git',  
                            credentialsId: "${GIT_CREDENTIALS}"
                        ]]
                    ])
                    
                    dir('k8s-manifests') {
                        checkout([
                            $class: 'GitSCM',
                            branches: [[name: '*/main']],
                            userRemoteConfigs: [[
                                url: 'https://github.com/CUFE-Software-Engineering-Project/SWE-twitter-infra.git',  
                                credentialsId: "${GIT_CREDENTIALS}"
                            ]]
                        ])
                    }

                    dir('frontend') {
                        checkout([
                            $class: 'GitSCM',
                            branches: [[name: '*/main']],
                            userRemoteConfigs: [[
                                url: 'https://github.com/CUFE-Software-Engineering-Project/SWE-twitter-Frontend.git',  
                                credentialsId: "${GIT_CREDENTIALS}"
                            ]]
                        ])
                    }
                }
            }
        }

        stage("Setup Backend Environment") {
            steps {
                container('nodejs') {
                    script {
                        // Copy secret file from credentials to workspace
                        withCredentials([file(credentialsId: "${BACKEND_SECRET_FILE}", variable: 'SECRET_FILE')]) {
                            sh '''
                                echo "Copying backend secret file..."
                                cp "${SECRET_FILE}" ./.env
                                echo "DATABASE_URL=${DATABASE_URL}" >> ./.env
                                
                                # Verify .env file exists
                                if [ -f ./.env ]; then
                                    echo ".env file created successfully"
                                    echo "Content preview (first 3 lines, hiding values):"
                                    head -3 ./.env | sed 's/=.*/=***HIDDEN***/'
                                else
                                    echo "Failed to create .env file"
                                    exit 1
                                fi
                            '''
                        }
                    }
                }
            }
        }

        stage("Linting") {
            steps {
                container('nodejs') {
                    script {
                        try {
                            sh '''
                                echo "Installing dependencies..."
                                npm ci --prefer-offline --no-audit
                                
                                echo "Running ESLint..."
                                npm run lint || true
                                
                                echo "Running Prettier check..."
                                npx prettier --check "src/**/*.{js,jsx,ts,tsx}" || true
                            '''
                        } catch (Exception e) {
                            echo "⚠️ Linting failed, but continuing pipeline execution..."
                            currentBuild.result = 'UNSTABLE'
                        }
                    }
                }
            }
        }

        stage("Database Migration & Schema Generation") {
            steps {
                container('nodejs') {
                    script {
                        sh '''
                            echo "Running Prisma migrations..."
                            npx prisma migrate deploy
                            
                            echo "Generating Prisma Client..."
                            npx prisma generate
                            
                            echo "Database schema is up to date"
                        '''
                        env.MIGRATED = 'true'
                    }
                }
            }
        }

        stage("Building with Kaniko") {
            steps {
                container('kaniko') {
                    script {
                        // Copy .env file for Docker build context
                        withCredentials([
                            file(credentialsId: "${BACKEND_SECRET_FILE}", variable: 'SECRET_FILE'),
                            usernamePassword(
                                credentialsId: "${DOCKER_REGISTRY_CREDENTIALS}",
                                usernameVariable: 'DOCKER_USER',
                                passwordVariable: 'DOCKER_PASS'
                            )
                        ]) {
                            sh '''
                                # Copy secret file to build context
                                cp "${SECRET_FILE}" ./.env
                                echo "DATABASE_URL=${DATABASE_URL}" >> ./.env
                                
                                echo "Creating Docker config for Kaniko..."
                                mkdir -p /kaniko/.docker
                                cat > /kaniko/.docker/config.json <<EOF
{
  "auths": {
    "https://index.docker.io/v1/": {
      "auth": "$(echo -n ${DOCKER_USER}:${DOCKER_PASS} | base64)"
    }
  }
}
EOF
                            '''
                            
                            sh """
                                echo "Building and pushing with Kaniko..."
                                /kaniko/executor \\
                                    --context=\$(pwd) \\
                                    --dockerfile=\$(pwd)/Dockerfile \\
                                    --destination=${DOCKER_IMAGE}:${BUILD_TAG} \\
                                    --destination=${DOCKER_IMAGE}:latest \\
                                    --cache=true \\
                                    --cache-ttl=24h \\
                                    --compressed-caching=false \\
                                    --cleanup
                            """
                        }
                    }
                }
            }
        }

        stage("Unit Testing") {
            steps {
                container('nodejs') {
                    sh """
                        echo "Running unit tests..."
                        npm i 
                        npm run test
                    """
                }
            }
        }

        stage("Deploy to Kubernetes") {
            steps {
                container('kubectl') {
                    script {
                        withCredentials([file(credentialsId: "${KUBE_CONFIG_CREDENTIALS}", variable: 'KUBECONFIG')]) {
                            sh """ 
                                echo "Updating deployment with new image..."
                                sed -i "s|image: .*swe-backend.*|image: ${DOCKER_IMAGE}:${BUILD_TAG}|g" k8s-manifests/kubernetes/'Node Backend'/node-deployment.yaml
                                
                                echo "Applying Kubernetes manifest..."
                                kubectl apply -f k8s-manifests/kubernetes/'Node Backend'/node-deployment.yaml
                                
                                echo "Waiting for rollout to complete..."
                                kubectl rollout status deployment/swe-node-deployment -n swe-twitter --timeout=5m
                                
                                echo "Deployment successful!"
                                echo "Current pod status:"
                                kubectl get pods -n swe-twitter -l app=node-pod
                            """
                        }
                    }
                }
            }
        }

        stage("E2E Testing") {
            steps {
                container('nodejs') {
                    script {
                        try {
                            sh """
                                echo "Running up E2E tests..."
                            """
                        } catch (Exception e) {
                            echo "❌ E2E tests failed! Rolling back deployment..."
                            container('kubectl') {
                                withCredentials([file(credentialsId: "${KUBE_CONFIG_CREDENTIALS}", variable: 'KUBECONFIG')]) {
                                    sh """
                                        echo "Rolling back backend deployment..."
                                        kubectl rollout undo deployment/swe-node-deployment -n swe-twitter
                                        kubectl rollout status deployment/swe-node-deployment -n swe-twitter --timeout=5m
                                        
                                        echo "Rollback completed"
                                        kubectl get pods -n swe-twitter -l app=node-pod
                                    """
                                }
                            }
                            error("E2E tests failed and deployment was rolled back")
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            emailext (
                subject: "✅ Jenkins Backend Build SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <h2>Backend Build Successful! 🎉</h2>
                    <p><strong>Job:</strong> ${env.JOB_NAME}</p>
                    <p><strong>Build Number:</strong> ${env.BUILD_NUMBER}</p>
                    <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                    <p><strong>Docker Image:</strong> ${DOCKER_IMAGE}:${BUILD_TAG}</p>
                    <hr>
                    <p>The backend application has been successfully deployed to Kubernetes.</p>
                    <p><strong>Deployment:</strong> swe-node-deployment</p>
                    <p><strong>Namespace:</strong> swe-twitter</p>
                """,
                to: "${EMAIL_RECIPIENTS}",
                mimeType: 'text/html'
            )
        }
        
        failure {
            script{
                if (env.MIGRATED == 'true') {
                    sh 'psql -d $DATABASE_URL -f prisma/migrations/last/down.sql'
                }
            }
            emailext (
                subject: "❌ Jenkins Backend Build FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: """
                    <h2>Backend Build Failed! ⚠️</h2>
                    <p><strong>Job:</strong> ${env.JOB_NAME}</p>
                    <p><strong>Build Number:</strong> ${env.BUILD_NUMBER}</p>
                    <p><strong>Build URL:</strong> <a href="${env.BUILD_URL}">${env.BUILD_URL}</a></p>
                    <p><strong>Console Output:</strong> <a href="${env.BUILD_URL}console">${env.BUILD_URL}console</a></p>
                    <hr>
                    <p>Please check the console output for error details.</p>
                """,
                to: "${EMAIL_RECIPIENTS}",
                mimeType: 'text/html'
            )
        }
        
        always {
            echo "Pipeline completed. Cleaning up sensitive files..."
            sh '''
                # Remove .env file with secrets
                rm -f ./.env
                rm -f ./frontend-e2e/.env
                echo "Cleanup completed"
            '''
        }
    }
}