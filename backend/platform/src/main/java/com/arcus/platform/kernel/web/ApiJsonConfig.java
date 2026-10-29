package com.arcus.platform.kernel.web;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;

/** API JSON conventions for every app: an omitted flag or number means false/0 rather than an error. */
@Configuration(proxyBeanMethods = false)
public class ApiJsonConfig {

    @Bean
    JsonMapperBuilderCustomizer arcusJsonConventions() {
        return builder -> builder.disable(DeserializationFeature.FAIL_ON_NULL_FOR_PRIMITIVES);
    }
}
