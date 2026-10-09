package org.qpcrplateplanner.app;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

final class LocalPolicy {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    static final String ENTRY = ORIGIN + "/assets/www/qPCR%20Plate%20Planner.html";
    static final int MAX_FILE_BYTES = 16 * 1024 * 1024;

    static String assetPath(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !"appassets.androidplatform.net".equalsIgnoreCase(uri.getHost()) || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            String path = uri.getPath();
            if (path == null || !path.startsWith("/assets/www/") || path.indexOf('\0') >= 0 || path.indexOf('\\') >= 0 || path.indexOf('%') >= 0) return null;
            for (String part : path.split("/", -1)) if (part.equals("..") || part.equals(".")) return null;
            // No service-worker cache or online updates inside the frozen APK.
            if (path.endsWith("/sw.js")) return null;
            return path.substring("/assets/".length());
        } catch (URISyntaxException | IllegalArgumentException ex) { return null; }
    }
    static String fileName(String value) {
        String name = value == null ? "" : value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (name.length() > 160) name = name.substring(0, 160);
        if (!(name.toLowerCase(Locale.ROOT).endsWith(".json") || name.toLowerCase(Locale.ROOT).endsWith(".csv"))) throw new IllegalArgumentException("仅支持保存项目 JSON 或 CSV。");
        return name;
    }
    static String exportMime(String name) { return name.toLowerCase(Locale.ROOT).endsWith(".json") ? "application/json" : "text/csv"; }
    static String mime(String file) {
        if (file.endsWith(".html")) return "text/html";
        if (file.endsWith(".js")) return "application/javascript";
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".json")) return "application/json";
        if (file.endsWith(".svg")) return "image/svg+xml";
        if (file.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }
}
