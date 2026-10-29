package com.arcus.platform.orgs;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.spi.FieldDef;
import com.arcus.platform.spi.Terms;
import com.arcus.platform.support.Money;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class OrgController {

    private final OrgService orgs;
    private final CatalogService catalog;
    private final AppRegistry registry;
    private final JdbcClient db;
    private final Tx tx;

    public OrgController(OrgService orgs, CatalogService catalog, AppRegistry registry, JdbcClient db, Tx tx) {
        this.orgs = orgs;
        this.catalog = catalog;
        this.registry = registry;
        this.db = db;
        this.tx = tx;
    }

    public record AppInfo(String id, String name, String tagline, Terms terms, String practitionerPrefix, List<FieldDef> contactFields,
                          List<String> modules, List<String> optionalModules) {
        static AppInfo of(AppDefinition a) {
            return new AppInfo(a.id(), a.name(), a.tagline(), a.terms(), a.practitionerPrefix(), a.contactFields(), a.modules(), a.optionalModules());
        }
    }

    /** Public: the apps a new practice can sign up for. */
    @GetMapping("/api/apps")
    public List<AppInfo> apps() {
        return registry.apps().stream().map(AppInfo::of).toList();
    }

    public record ModuleInfo(String id, String name, String description, boolean enabled) {
    }

    public record MembershipInfo(UUID orgId, String orgName, String app) {
    }

    public record SessionInfo(Principal principal, OrgService.Org org, OrgService.Member me, AppInfo app, List<ModuleInfo> modules,
                              List<MembershipInfo> memberships) {
    }

    /** Everything the UI needs about the signed-in user, their organization and its app. */
    @GetMapping("/api/session")
    public SessionInfo session() {
        Principal p = TenantContext.require();
        AppDefinition app = registry.app(p.app());
        List<ModuleInfo> modules = registry.allowedModules(app).stream()
                .map(id -> new ModuleInfo(id, registry.module(id).name(), registry.module(id).description(), p.hasModule(id))).toList();
        List<MembershipInfo> memberships = tx.system(() -> db.sql("""
                        SELECT o.id, o.name, o.app FROM memberships m JOIN organizations o ON o.id = m.org_id
                        WHERE m.user_id = ? AND m.active ORDER BY m.created_at""").param(p.userId())
                .query((rs, n) -> new MembershipInfo(Sql.uuid(rs, "id"), rs.getString("name"), rs.getString("app"))).list());
        return new SessionInfo(p, orgs.current(), orgs.me(), AppInfo.of(app), modules, memberships);
    }

    @PutMapping("/api/org")
    public OrgService.Org updateProfile(@RequestBody OrgService.Profile body) {
        orgs.updateProfile(body);
        return orgs.current();
    }

    public record Modules(List<String> modules) {
    }

    @PutMapping("/api/org/modules")
    public Modules setModules(@RequestBody Modules body) {
        return new Modules(orgs.setModules(body.modules() == null ? List.of() : body.modules()));
    }

    @PutMapping("/api/me")
    public Map<String, Boolean> updateMe(@RequestBody OrgService.MyProfile body) {
        orgs.updateMyProfile(body);
        return Map.of("ok", true);
    }

    @GetMapping("/api/team")
    public List<OrgService.Member> team() {
        return orgs.team();
    }

    @PostMapping("/api/team")
    public List<OrgService.Member> addMember(@RequestBody OrgService.NewMember body) {
        orgs.addMember(body);
        return orgs.team();
    }

    @DeleteMapping("/api/team/{id}")
    public Map<String, Boolean> removeMember(@PathVariable UUID id) {
        orgs.removeMember(id);
        return Map.of("ok", true);
    }

    @GetMapping("/api/catalog")
    public List<CatalogService.Item> catalog(@RequestParam(defaultValue = "SERVICE") String kind) {
        return catalog.list(kind);
    }

    public record NewService(String name, String price) {
    }

    /** Platform-managed catalog kind: billable services. Apps add their own kinds through their own endpoints. */
    @PostMapping("/api/catalog/services")
    public CatalogService.Item addService(@RequestBody NewService body) {
        return catalog.add("SERVICE", body.name(), Money.rupeesToPaise(body.price()), Map.of());
    }

    @DeleteMapping("/api/catalog/{id}")
    public Map<String, Boolean> removeCatalogItem(@PathVariable UUID id) {
        catalog.remove(id);
        return Map.of("ok", true);
    }
}
