package com.arcus.apps.legal;

import com.arcus.platform.PlatformAutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.ComponentScan;

/** Installs Arcus Legal when its jar is on the classpath. */
@AutoConfiguration(after = PlatformAutoConfiguration.class)
@ComponentScan
public class LegalAutoConfiguration {
}
