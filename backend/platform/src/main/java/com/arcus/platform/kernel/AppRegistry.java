package com.arcus.platform.kernel;

import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.spi.ModuleDefinition;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/** The apps and modules this deployment runs, discovered from Spring beans. */
@Component
public class AppRegistry {

    private final Map<String, AppDefinition> apps;
    private final Map<String, ModuleDefinition> modules;

    public AppRegistry(List<AppDefinition> apps, List<ModuleDefinition> modules) {
        this.apps = apps.stream().collect(Collectors.toMap(AppDefinition::id, Function.identity(), (a, b) -> {
            throw new IllegalStateException("Two apps registered with id " + a.id());
        }, LinkedHashMap::new));
        this.modules = modules.stream().collect(Collectors.toMap(ModuleDefinition::id, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        for (AppDefinition app : apps) {
            for (String m : allowedModules(app)) {
                if (!this.modules.containsKey(m)) throw new IllegalStateException("App " + app.id() + " uses unknown module " + m);
            }
        }
    }

    public List<AppDefinition> apps() {
        return List.copyOf(apps.values());
    }

    public Optional<AppDefinition> find(String id) {
        return Optional.ofNullable(apps.get(id));
    }

    public AppDefinition app(String id) {
        return find(id).orElseThrow(() -> new IllegalStateException("Unknown app " + id + " (is its module on the classpath?)"));
    }

    public ModuleDefinition module(String id) {
        return modules.get(id);
    }

    public List<String> allowedModules(AppDefinition app) {
        List<String> all = new ArrayList<>(app.modules());
        app.optionalModules().stream().filter(m -> !all.contains(m)).forEach(all::add);
        return all;
    }

    /** Modules an organization has switched on, limited to what its app allows. */
    public List<String> enabledModules(AppDefinition app, List<String> orgModules) {
        List<String> allowed = allowedModules(app);
        return orgModules.stream().filter(allowed::contains).toList();
    }

    /** 403 unless the current organization has this module switched on. */
    public static void requireModule(String module) {
        if (!TenantContext.require().hasModule(module)) throw new UserError.Forbidden("This feature is not switched on.");
    }

    /** 403 unless the current organization runs this app. Used by every app-owned endpoint. */
    public static Principal requireApp(String appId) {
        Principal p = TenantContext.require();
        if (!appId.equals(p.app())) throw new UserError.Forbidden("Not available for this practice.");
        return p;
    }

    /** 403 unless the current user is an owner or admin. */
    public static Principal requireManager() {
        Principal p = TenantContext.require();
        if (!p.role().canManage()) throw new UserError.Forbidden("Only the owner or an admin can do this.");
        return p;
    }
}
