package com.arcus.platform.tasks;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService tasks;

    public TaskController(TaskService tasks) {
        this.tasks = tasks;
    }

    @GetMapping
    public List<TaskService.Task> upcoming() {
        return tasks.upcoming(14);
    }

    @PostMapping
    public Map<String, UUID> create(@RequestBody TaskService.NewTask body) {
        return Map.of("id", tasks.create(body));
    }

    public record Status(String status) {
    }

    @PostMapping("/{id}/status")
    public Map<String, Boolean> status(@PathVariable UUID id, @RequestBody Status body) {
        tasks.setStatus(id, body.status());
        return Map.of("ok", true);
    }

    @PostMapping("/{id}/remind")
    public Map<String, Boolean> remind(@PathVariable UUID id) {
        return Map.of("sent", tasks.remind(id));
    }

    @PostMapping("/remind-tomorrow")
    public Map<String, Integer> remindTomorrow() {
        return Map.of("sent", tasks.remindTomorrow());
    }
}
