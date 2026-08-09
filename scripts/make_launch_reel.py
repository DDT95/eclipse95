from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, os, subprocess, sys

W,H,FPS,DURATION=1080,1920,24,16
NAVY=(7,29,87); GREEN=(47,158,68); RED=(224,49,49); MUTED=(95,107,122)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIVE='/var/folders/3h/px_6bwl96w50x8y34bkz_k_80000gn/T/codex-clipboard-1f26707e-ec67-44dc-9c6e-51c5f00b7e04.png'
LOGO=os.path.join(ROOT,'public/assets/cartokob-logo-app-transparent.png')
OUT=os.path.join(ROOT,'public/media/cartokob-lancement-reel.mp4')
FONT='/System/Library/Fonts/Helvetica.ttc'; BOLD='/System/Library/Fonts/Helvetica.ttc'

def font(size,bold=False): return ImageFont.truetype(BOLD if bold else FONT,size,index=1 if bold else 0)
def ease(x): return 3*x*x-2*x*x*x
def cover(im,w=W,h=H,zoom=1,px=.5,py=.5):
    scale=max(w/im.width,h/im.height)*zoom; nw,nh=int(im.width*scale),int(im.height*scale)
    im=im.resize((nw,nh),Image.Resampling.LANCZOS)
    x=int((nw-w)*px); y=int((nh-h)*py)
    return im.crop((max(0,x),max(0,y),max(0,x)+w,max(0,y)+h)).convert('RGBA')
def rounded(draw,box,r,fill,outline=None,width=1): draw.rounded_rectangle(box,radius=r,fill=fill,outline=outline,width=width)
def centered(draw,text,y,size,color=(255,255,255),bold=True):
    f=font(size,bold); box=draw.textbbox((0,0),text,font=f); draw.text(((W-(box[2]-box[0]))/2,y),text,font=f,fill=color)
def pill(frame,text,y,fg=NAVY,bg=(255,255,255,244),size=38):
    d=ImageDraw.Draw(frame); f=font(size,True); b=d.textbbox((0,0),text,font=f); ww=b[2]-b[0]+72
    rounded(d,((W-ww)//2,y,(W+ww)//2,y+76),38,bg); d.text(((W-(b[2]-b[0]))/2,y+17),text,font=f,fill=fg)
def score_card(frame,score,label,color,detail,progress):
    d=ImageDraw.Draw(frame); y=int(H-560+50*(1-ease(progress)))
    rounded(d,(54,y,W-54,y+430),44,(255,255,255,248))
    d.ellipse((92,y+70,350,y+328),fill=(245,248,250),outline=color,width=20)
    sf=font(94,True); sb=d.textbbox((0,0),str(score),font=sf); d.text((221-(sb[2]-sb[0])/2,y+130),str(score),font=sf,fill=NAVY)
    d.text((400,y+92),label,font=font(48,True),fill=color)
    d.text((400,y+166),detail,font=font(31),fill=MUTED)
    d.line((400,y+235,W-105,y+235),fill=(220,227,234),width=3)
    d.text((400,y+268),'Regardez vers 284°',font=font(34,True),fill=NAVY)
    d.text((400,y+320),'ouest-nord-ouest · 20:19',font=font(28),fill=MUTED)

live=Image.open(LIVE).convert('RGBA'); mock=live; logo=Image.open(LOGO).convert('RGBA')
os.makedirs(os.path.dirname(OUT),exist_ok=True)
ffmpeg=os.environ['FFMPEG_BIN']
cmd=[ffmpeg,'-y','-f','rawvideo','-pix_fmt','rgba','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-f','lavfi','-i',f'anullsrc=channel_layout=stereo:sample_rate=44100','-shortest','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','128k',OUT]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for n in range(FPS*DURATION):
    t=n/FPS
    if t<3:
        q=ease(t/3); frame=cover(mock,zoom=1.12+.08*q,py=.18+.03*q).filter(ImageFilter.GaussianBlur(1.2))
        shade=Image.new('RGBA',(W,H),(7,29,87,80)); frame=Image.alpha_composite(frame,shade); d=ImageDraw.Draw(frame)
        centered(d,'Où voir l’éclipse ?',230,72); centered(d,'12 août 2026',320,42,(255,255,255),False)
        pill(frame,'Une carte pour choisir le bon endroit',465,size=32)
    elif t<6:
        q=ease((t-3)/3); frame=cover(mock,zoom=1.2+.23*q,px=.52,py=.18)
        d=ImageDraw.Draw(frame); rounded(d,(55,105,W-55,230),36,(255,255,255,248)); d.ellipse((88,145,128,185),outline=NAVY,width=6); d.line((120,178,143,201),fill=NAVY,width=6)
        typed='Fontainebleau'[:max(0,min(13,int(q*16)))]; d.text((166,139),typed,font=font(43),fill=NAVY)
        pill(frame,'Touchez la carte · analyse en cours…',290,size=31)
    elif t<9.5:
        q=min(1,(t-6)/.7); frame=cover(mock,zoom=1.42,px=.5,py=.20).filter(ImageFilter.GaussianBlur(7)); frame=Image.alpha_composite(frame,Image.new('RGBA',(W,H),(255,255,255,42))); score_card(frame,89,'Très favorable',GREEN,'Horizon dégagé · éclaircies',q)
        pill(frame,'Un point favorable',130,fg=GREEN,size=36)
    elif t<13:
        q=min(1,(t-9.5)/.7); frame=cover(live,zoom=1.45,px=.52,py=.42).filter(ImageFilter.GaussianBlur(8))
        frame=Image.alpha_composite(frame,Image.new('RGBA',(W,H),(80,10,10,105))); score_card(frame,24,'Défavorable',RED,'Forêt dans l’axe · Soleil masqué',q)
        pill(frame,'Un obstacle réel dans la direction',130,fg=RED,size=32)
    elif t<14.5:
        frame=Image.new('RGBA',(W,H),(250,248,246,255)); d=ImageDraw.Draw(frame)
        centered(d,'Observez en sécurité',470,66,NAVY); centered(d,'Lunettes certifiées ISO 12312-2',585,36,RED)
        centered(d,'Respectez les propriétés privées',660,32,MUTED,False); centered(d,'et restez hors des voies de circulation.',710,32,MUTED,False)
    else:
        frame=Image.new('RGBA',(W,H),NAVY+(255,)); q=ease((t-14.5)/1.5)
        lw=int(830*(.92+.08*q)); lh=int(logo.height*lw/logo.width); lg=logo.resize((lw,lh),Image.Resampling.LANCZOS)
        white=Image.new('RGBA',lg.size,(255,255,255,0)); white.putalpha(lg.getchannel('A')); frame.alpha_composite(white,((W-lw)//2,620))
        d=ImageDraw.Draw(frame); centered(d,'La carte est en ligne',1010,48,(255,255,255)); centered(d,'cartokob.pages.dev',1090,40,(170,216,255),False)
        centered(d,'Où voir l’éclipse ?',1260,36,(255,255,255),False)
    p.stdin.write(frame.tobytes())
p.stdin.close(); code=p.wait()
if code: raise SystemExit(code)
print(OUT)
