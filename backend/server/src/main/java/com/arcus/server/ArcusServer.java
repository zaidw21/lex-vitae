package com.arcus.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * The Arcus API. The platform and every app on the classpath (see pom.xml) install themselves through
 * Spring Boot auto-configuration; this class only starts the application.
 */
@SpringBootApplication
public class ArcusServer {

    public static void main(String[] args) {
        SpringApplication.run(ArcusServer.class, args);
    }
}
