package com.arcus.platform;

import com.arcus.platform.kernel.ArcusProperties;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;

/**
 * Activates the platform in any Spring Boot application that has it on the classpath. Runs before Boot's
 * transaction manager so the tenant-aware one (row-level security) is used everywhere.
 */
@AutoConfiguration(before = DataSourceTransactionManagerAutoConfiguration.class)
@EnableConfigurationProperties(ArcusProperties.class)
@ComponentScan
public class PlatformAutoConfiguration {
}
