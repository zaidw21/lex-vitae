package com.arcus.platform.insights;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class InsightsController {

    private final InsightsService insights;

    public InsightsController(InsightsService insights) {
        this.insights = insights;
    }

    @GetMapping("/api/dashboard")
    public InsightsService.Dashboard dashboard() {
        return insights.dashboard();
    }
}
