package org.qpcrplateplanner.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JsResult;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.util.Base64;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int OPEN_FILE = 100, SAVE_FILE = 101;
    private WebView webView;
    private FrameLayout root;
    private WebMessagePort channel;
    private ValueCallback<Uri[]> fileCallback;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private Export pendingExport;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private boolean printing;

    private static final class Export {
        final int id; final String name; final byte[] bytes;
        Export(int id, String name, byte[] bytes) { this.id=id; this.name=name; this.bytes=bytes; }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(244,247,250));
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(-1,-1)); setContentView(root);
        // Respect status/navigation bars, display cutouts and resized keyboard on Android 15+.
        root.setOnApplyWindowInsetsListener((view,insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true); settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) { return localResponse(request.getUrl().toString()); }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                String url=request.getUrl().toString();
                if (url.equals(LocalPolicy.ENTRY) || url.startsWith(LocalPolicy.ENTRY+"#")) return false;
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) { if(channel!=null){channel.close();channel=null;} }
            @Override public void onPageFinished(WebView view,String url) {
                if (!LocalPolicy.ENTRY.equals(url)) return;
                WebMessagePort[] ports=view.createWebMessageChannel(); channel=ports[0];
                channel.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort port,WebMessage message){handleMessage(message.getData());}});
                view.postWebMessage(new WebMessage("qpcr-native-ready",new WebMessagePort[]{ports[1]}),Uri.parse(LocalPolicy.ORIGIN));
            }
        });
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient(){@Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){return localResponse(request.getUrl().toString());}});
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("*/*");
                String[] accepted=params.getAcceptTypes();
                boolean json=false;for(String type:accepted)if(type.equals(".json")||type.startsWith("application/json"))json=true;
                intent.putExtra(Intent.EXTRA_MIME_TYPES,json?new String[]{"application/json","text/plain","application/octet-stream"}:new String[]{"text/csv","text/tab-separated-values","text/plain","application/vnd.ms-excel","application/octet-stream"});
                try { startActivityForResult(intent,OPEN_FILE); } catch(ActivityNotFoundException ex) {fileCallback.onReceiveValue(null);fileCallback=null;toast("系统没有文件选择器。");}
                return true;
            }
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("qPCR Plate Planner").setMessage(message).setPositiveButton("确定",(dialog,which)->result.confirm()).setNegativeButton("取消",(dialog,which)->result.cancel()).setOnCancelListener(dialog->result.cancel()).show();return true;
            }
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setTitle("qPCR Plate Planner").setMessage(message).setPositiveButton("确定",(dialog,which)->result.confirm()).setOnCancelListener(dialog->result.cancel()).show();return true;
            }
            @Override public void onShowCustomView(View view,CustomViewCallback callback) {
                if(fullscreenView!=null){callback.onCustomViewHidden();return;}
                fullscreenView=view;fullscreenCallback=callback;webView.setVisibility(View.GONE);root.addView(view,new FrameLayout.LayoutParams(-1,-1));
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
            }
            @Override public void onHideCustomView(){leaveFullscreen();}
        });
        webView.setDownloadListener((url,agent,disposition,mime,size)->toast("请使用页面的 JSON/CSV 导出按钮，并在系统文件选择器确认保存。"));
        webView.loadUrl(LocalPolicy.ENTRY);
    }
    private WebResourceResponse localResponse(String url) {
        String path=LocalPolicy.assetPath(url);
        try {
            if(path==null)throw new IOException("blocked");
            InputStream input=getAssets().open(path);
            return new WebResourceResponse(LocalPolicy.mime(path),"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-cache"),input);
        } catch(IOException ex) {
            return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream("Resource unavailable".getBytes(StandardCharsets.UTF_8)));
        }
    }
    private void handleMessage(String text) {
        if(text==null || text.length()>24*1024*1024)return;
        try {
            JSONObject message=new JSONObject(text);
            switch(message.getString("type")) {
                case "save": save(message); break;
                case "print": print(message.optString("orientation","portrait")); break;
                case "awake": if(message.optBoolean("enabled"))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); break;
                default: break;
            }
        } catch(Exception ex) {toast("无法执行系统操作，请重试。");}
    }
    private void save(JSONObject message) throws Exception {
        int id=message.getInt("id"); String name=LocalPolicy.fileName(message.getString("name"));
        if(pendingExport!=null){saveResult(id,name,"error","上一份文件仍在等待保存，请先完成系统操作。");return;}
        byte[] bytes=Base64.decode(message.getString("base64"),Base64.DEFAULT);
        if(bytes.length>LocalPolicy.MAX_FILE_BYTES){saveResult(id,name,"error","文件超过 16 MB。");return;}
        pendingExport=new Export(id,name,bytes);
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(LocalPolicy.exportMime(name));intent.putExtra(Intent.EXTRA_TITLE,name);
        try{startActivityForResult(intent,SAVE_FILE);}catch(ActivityNotFoundException ex){pendingExport=null;saveResult(id,name,"error","系统没有文件保存器。");}
    }
    @Override protected void onActivityResult(int request,int result,Intent data) {
        super.onActivityResult(request,result,data);
        if(request==OPEN_FILE && fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
        if(request!=SAVE_FILE||pendingExport==null)return;
        Export file=pendingExport;pendingExport=null;
        if(result!=RESULT_OK||data==null||data.getData()==null){saveResult(file.id,file.name,"cancelled","");return;}
        Uri uri=data.getData();
        writer.execute(()->{
            try(OutputStream stream=getContentResolver().openOutputStream(uri,"wt")){
                if(stream==null)throw new IOException("无法写入所选位置");stream.write(file.bytes);stream.flush();
                runOnUiThread(()->saveResult(file.id,file.name,"saved",""));
            }catch(Exception ex){runOnUiThread(()->saveResult(file.id,file.name,"error","无法写入所选位置，请重新选择。"));}
        });
    }
    private void saveResult(int id,String name,String status,String detail) {
        try {JSONObject reply=new JSONObject();reply.put("type","save-result");reply.put("id",id);reply.put("name",name);reply.put("status",status);reply.put("message",detail);post(reply);}catch(Exception ignored){}
    }
    private void print(String orientation) {
        if(printing)return;
        PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);
        if(manager==null){toast("系统没有打印服务。");afterPrint();return;}
        printing=true;
        PrintDocumentAdapter original=webView.createPrintDocumentAdapter("qPCR Plate Planner");
        PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
            @Override public void onStart(){original.onStart();}
            @Override public void onLayout(PrintAttributes oldA,PrintAttributes newA,CancellationSignal signal,LayoutResultCallback callback,Bundle extras){original.onLayout(oldA,newA,signal,callback,extras);}
            @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor destination,CancellationSignal signal,WriteResultCallback callback){original.onWrite(pages,destination,signal,callback);}
            @Override public void onFinish(){original.onFinish();runOnUiThread(()->afterPrint());}
        };
        PrintAttributes.MediaSize size="landscape".equals(orientation)?PrintAttributes.MediaSize.ISO_A4.asLandscape():PrintAttributes.MediaSize.ISO_A4.asPortrait();
        try{manager.print("qPCR Plate Planner",adapter,new PrintAttributes.Builder().setMediaSize(size).build());}catch(Exception ex){toast("无法启动系统打印。");afterPrint();}
    }
    private void afterPrint(){printing=false;try{post(new JSONObject().put("type","afterprint"));}catch(Exception ignored){}}
    private void post(JSONObject message){if(channel!=null&&!isFinishing())try{channel.postMessage(new WebMessage(message.toString()));}catch(IllegalStateException ignored){}}
    private void toast(String message){Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
    private void leaveFullscreen(){if(fullscreenView==null)return;root.removeView(fullscreenView);fullscreenView=null;webView.setVisibility(View.VISIBLE);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);WebChromeClient.CustomViewCallback callback=fullscreenCallback;fullscreenCallback=null;if(callback!=null)callback.onCustomViewHidden();root.requestApplyInsets();}
    @Override public void onBackPressed(){if(fullscreenView!=null){leaveFullscreen();return;}webView.evaluateJavascript("(()=>{const button=document.getElementById('tgExit');if(button){button.click();return true;}window.dispatchEvent(new Event('pagehide'));return false;})()",value->{if(!"true".equals(value))finish();});}
    @Override protected void onPause(){webView.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))",null);webView.onPause();super.onPause();}
    @Override protected void onResume(){super.onResume();if(webView!=null)webView.onResume();}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(channel!=null)channel.close();webView.destroy();writer.shutdown();super.onDestroy();}
}
