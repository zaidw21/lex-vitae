package com.arcus.platform.kernel;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import javax.sql.DataSource;

@Configuration(proxyBeanMethods = false)
@EnableTransactionManagement
public class DatabaseConfig {

    @Bean
    @Primary
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new TenantTransactionManager(dataSource);
    }

    @Bean
    public JdbcClient jdbcClient(DataSource dataSource) {
        return JdbcClient.create(dataSource);
    }
}
