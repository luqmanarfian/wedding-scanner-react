pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
    }

    environment {
        APP_NAME = "wedding-scanner-react"
        IMAGE_NAME = "luqmanarfian/wedding-scanner-react"
        IMAGE_TAG = "${env.GIT_COMMIT}"
        BRANCH = "main"
        SONARQUBE_SERVER = "sonarqube-server"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Create env file') {
            steps {
                withCredentials([
                    file(credentialsId: 'wedding-scanner-env-production', variable: 'ENV_FILE')
                ]) {
                    sh '''
                        set +x
                        cp "$ENV_FILE" .env.production
                    '''
                }
            }
        }
        stage('Install & Test') {
            agent {
                docker {
                    image 'node:20-alpine'
                    reuseNode true
                }
            }
            steps {
                sh 'npm ci'
                sh 'npm run coverage'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                script {
                    def scannerHome = tool 'SonarScanner'
                    withSonarQubeEnv("${SONARQUBE_SERVER}") {
                        sh """
                        ${scannerHome}/bin/sonar-scanner \
                        -Dsonar.projectKey=${APP_NAME} \
                        -Dsonar.host.url=$SONAR_HOST_URL \
                        -Dsonar.token=$SONAR_AUTH_TOKEN
                        """
                    }
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${IMAGE_NAME}:${IMAGE_TAG}")
                }
            }
        }

        stage('Security Scan') {
            steps {
                // Menjalankan perintah lewat 'docker run' langsung terbukti jauh lebih stabil daripada
                // menggunakan agent { docker } yang rentan terhadap timeout heartbeat Jenkins (durable-task).
                // Menyertakan docker.sock agar Trivy bisa membaca image Docker lokal hasil build sebelumnya,
                // serta menggunakan Docker Named Volume untuk cache yang dijamin bebas konflik filesystem.
                sh """
                docker run --rm \
                  -v /var/run/docker.sock:/var/run/docker.sock \
                  -v trivy-cache-${APP_NAME}:/root/.cache/trivy \
                  aquasec/trivy:0.51.1 image \
                  --exit-code 1 \
                  --severity HIGH,CRITICAL \
                  ${IMAGE_NAME}:${IMAGE_TAG}
                """
            }
        }

        stage('Push Docker Image') {
            steps {
                script {
                    docker.withRegistry('', 'docker-cred') {
                        docker.image("${IMAGE_NAME}:${IMAGE_TAG}").push()
                    }
                }
            }
        }

        stage('Deploy with Helm') {
            steps {
                sh """
                helm upgrade --install ${APP_NAME} ./helm/charts \
                --set image.name=${IMAGE_NAME}:${IMAGE_TAG}
                """
            }
        }

        stage('Verify Deployment') {
            steps {
                sh "kubectl rollout status deployment/${APP_NAME}"
            }
        }
    }

    post {
        success {
            echo "Pipeline succeeded! Image ${IMAGE_NAME}:${IMAGE_TAG} deployed."
        }
        failure {
            echo "Pipeline failed! Rolling back ${APP_NAME}..."
            sh "helm rollback ${APP_NAME} || echo 'Rollback failed or not applicable'"
        }
        always {
            sh 'rm -f .env .env.production || true'
            cleanWs(deleteDirs: true, disableDeferredWipeout: true)
        }
    }
}
