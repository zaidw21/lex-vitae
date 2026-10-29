package com.arcus.apps.clinic;

import com.arcus.platform.PlatformAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.ComponentScan;

/** Installs Arcus Clinic when its jar is on the classpath. */
@AutoConfiguration(after = PlatformAutoConfiguration.class)
@ComponentScan
public class ClinicAutoConfiguration {
}
