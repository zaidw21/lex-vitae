# Arcus API: the platform plus every app module listed in server/pom.xml, as one Spring Boot jar.
# Build:  docker build -t arcus-api backend
# Run:    docker run -p 8080:8080 -e DATABASE_URL=jdbc:postgresql://host:5432/arcus -e DATABASE_USER=... -e DATABASE_PASSWORD=... arcus-api
# Migrations are applied on start. Demo data: add --spring.profiles.active=seed (exits when done).

FROM eclipse-temurin:21-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY platform/pom.xml platform/
COPY apps/clinic/pom.xml apps/clinic/
COPY apps/legal/pom.xml apps/legal/
COPY server/pom.xml server/
RUN ./mvnw -B -q dependency:go-offline -DexcludeReactor=true || true
COPY . .
# Tests need Postgres (Testcontainers) and run in CI, not in the image build.
RUN ./mvnw -B package -DskipTests

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 arcus
WORKDIR /app
COPY --from=build /src/server/target/arcus-server.jar app.jar
USER arcus
ENV PORT=8080 JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://localhost:${PORT}/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
