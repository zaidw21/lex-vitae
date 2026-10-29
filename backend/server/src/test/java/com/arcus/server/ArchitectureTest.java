package com.arcus.server;

import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.Tx;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Architecture rules, checked on every build (Maven module dependencies already stop the platform from
 * depending on apps at compile time; these rules cover what Maven can't).
 */
class ArchitectureTest {

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .withImportOption(location -> !location.contains("-tests.jar") && !location.contains("/test-classes/"))
            .importPackages("com.arcus");

    @Test
    void platformNeverDependsOnAppsOrTheServer() {
        noClasses().that().resideInAPackage("com.arcus.platform..")
                .should().dependOnClassesThat().resideInAnyPackage("com.arcus.apps..", "com.arcus.server..")
                .check(classes);
    }

    @Test
    void appsNeverDependOnEachOther() {
        noClasses().that().resideInAPackage("com.arcus.apps.clinic..").should().dependOnClassesThat().resideInAPackage("com.arcus.apps.legal..").check(classes);
        noClasses().that().resideInAPackage("com.arcus.apps.legal..").should().dependOnClassesThat().resideInAPackage("com.arcus.apps.clinic..").check(classes);
    }

    @Test
    void onlyThePlatformAndServerMayLeaveTheTenantScope() {
        noClasses().that().resideOutsideOfPackages("com.arcus.platform..", "com.arcus.server..")
                .should().callMethod(TenantContext.class, "asSystem", java.util.function.Supplier.class)
                .orShould().callMethod(Tx.class, "system", java.util.function.Supplier.class)
                .orShould().callMethod(TenantContext.class, "asOrg", java.util.UUID.class, java.util.function.Supplier.class)
                .orShould().callMethod(Tx.class, "asOrg", java.util.UUID.class, java.util.function.Supplier.class)
                .check(classes);
    }

    @Test
    void configurationComesFromThePlatformNotTheEnvironment() {
        noClasses().should().callMethod(System.class, "getenv", String.class)
                .orShould().callMethod(System.class, "getenv")
                .check(classes);
    }

    @Test
    void appsUseThePlatformLoggerNotTheirOwn() {
        noClasses().that().resideInAPackage("com.arcus.apps..")
                .should().dependOnClassesThat().resideInAnyPackage("org.slf4j..", "ch.qos.logback..", "java.util.logging..")
                .check(classes);
    }
}
