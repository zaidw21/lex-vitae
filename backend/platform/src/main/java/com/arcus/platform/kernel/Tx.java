package com.arcus.platform.kernel;

import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

/**
 * Explicit transactions. Most services just use {@code @Transactional}; this is for work that must run in a
 * specific tenant scope. The scope is fixed when a transaction begins, so these always start a new one.
 */
@Component
public class Tx {

    private final TransactionTemplate template;

    public Tx(PlatformTransactionManager transactionManager) {
        this.template = new TransactionTemplate(transactionManager);
        this.template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** A new transaction scoped to the current organization. */
    public <T> T run(Supplier<T> work) {
        return template.execute(status -> work.get());
    }

    /** A new transaction with row-level security bypassed (sign-in, public links, provisioning). */
    public <T> T system(Supplier<T> work) {
        return TenantContext.asSystem(() -> template.execute(status -> work.get()));
    }

    /** A new transaction scoped to one organization, without a signed-in user. */
    public <T> T asOrg(java.util.UUID orgId, Supplier<T> work) {
        return TenantContext.asOrg(orgId, () -> template.execute(status -> work.get()));
    }
}
