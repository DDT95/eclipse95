from PIL import Image,ImageDraw,ImageFont,ImageFilter
import os,subprocess,math

W,H,FPS,DURATION=1080,1920,30,34
NAVY=(7,29,87); GREEN=(47,158,68); RED=(224,49,49); WHITE=(255,255,255); MUTED=(205,217,235)
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAP=os.path.join(ROOT,'tmp/reel-captures'); LOGO=os.path.join(ROOT,'public/assets/cartokob-logo-app-transparent.png')
OUT=os.path.join(ROOT,'public/media/ou-voir-eclipse-lancement-reel.mp4')
FONT='/System/Library/Fonts/Helvetica.ttc'
def font(n,b=False): return ImageFont.truetype(FONT,n,index=1 if b else 0)
def ease(x): x=max(0,min(1,x)); return 3*x*x-2*x*x*x
def cover(im,zoom=1,px=.5,py=.5):
 s=max(W/im.width,H/im.height)*zoom; nw,nh=int(im.width*s),int(im.height*s); r=im.resize((nw,nh),Image.Resampling.LANCZOS)
 return r.crop((int((nw-W)*px),int((nh-H)*py),int((nw-W)*px)+W,int((nh-H)*py)+H)).convert('RGBA')
def center(d,txt,y,n,color=WHITE,b=True):
 f=font(n,b); box=d.textbbox((0,0),txt,font=f); d.text(((W-box[2]+box[0])/2,y),txt,font=f,fill=color)
def caption(frame,title,body='',color=NAVY,y=158):
 d=ImageDraw.Draw(frame); d.rounded_rectangle((46,y,W-46,y+142),30,fill=(255,255,255,246)); d.rectangle((46,y,60,y+142),fill=color)
 d.text((90,y+26),title,font=font(38,True),fill=color)
 if body:d.text((90,y+79),body,font=font(25),fill=(75,89,112))
def shot(name): return Image.open(os.path.join(CAP,name+'.png')).convert('RGBA')
imgs={k:shot(k) for k in ['01-safety','02-home','03-search-favorable','04-loading-favorable','05-favorable-result','06-favorable-horizon','07-search-unfavorable','08-loading-unfavorable','09-unfavorable-result','10-unfavorable-horizon']}
logo=Image.open(LOGO).convert('RGBA'); os.makedirs(os.path.dirname(OUT),exist_ok=True)
ff=os.environ['FFMPEG_BIN']; cmd=[ff,'-y','-f','rawvideo','-pix_fmt','rgba','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100','-shortest','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart','-c:a','aac','-b:a','128k',OUT]
p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
for n in range(FPS*DURATION):
 t=n/FPS
 if t<2.4:
  frame=Image.new('RGBA',(W,H),(3,10,29,255)); d=ImageDraw.Draw(frame); q=ease(t/2.4)
  x=W//2; y=H//2-70; r=170; d.ellipse((x-r,y-r,x+r,y+r),fill=(255,248,224)); d.ellipse((x-r+int(245*q),y-r-12,x+r+int(245*q),y+r-12),fill=(3,10,29))
  center(d,'12 AOÛT 2026',1240,34,MUTED,True)
 elif t<4.6:
  frame=Image.new('RGBA',(W,H),NAVY+(255,)); d=ImageDraw.Draw(frame); q=ease((t-2.4)/2.2)
  center(d,'Une éclipse.',570,78,WHITE,True); center(d,'Mais où la regarder ?',700,58,(130,213,255),True)
  d.rounded_rectangle((260,905,820,990),42,fill=(255,255,255,int(245*q))); center(d,'La réponse est sur la carte.',925,31,NAVY,True)
 elif t<6.8:
  q=ease((t-4.6)/2.2); frame=cover(imgs['01-safety'],1+.035*q,py=.46); caption(frame,'D’abord : protéger ses yeux','Lunettes certifiées ISO 12312-2',RED,120)
 elif t<8.6:
  q=ease((t-6.8)/1.8); frame=cover(imgs['02-home'],1+.04*q,py=.48); caption(frame,'Ouvrez « Où voir l’éclipse ? »','La carte couvre toute la France',NAVY,120)
 elif t<10.4:
  q=ease((t-8.6)/1.8); frame=cover(imgs['03-search-favorable'],1+.035*q,py=.39); caption(frame,'1. Recherchez un lieu','Exemple réel : Aéroport de Paris-Orly',NAVY,285)
 elif t<12.0:
  q=ease((t-10.4)/1.6); frame=cover(imgs['04-loading-favorable'],1+.025*q,py=.44); caption(frame,'2. L’analyse démarre','Relief · météo · bâti · végétation',NAVY,120)
 elif t<15.8:
  q=ease((t-12)/3.8); frame=cover(imgs['05-favorable-result'],1+.025*q,py=.50); caption(frame,'87/100 · Très favorable','Direction 284° · heure conseillée 20:19',GREEN,118)
 elif t<19.2:
  q=ease((t-15.8)/3.4); frame=cover(imgs['06-favorable-horizon'],1+.035*q,py=.54); caption(frame,'Le profil d’horizon explique le score','Le Soleil reste au-dessus des obstacles',GREEN,118)
 elif t<20.8:
  frame=Image.new('RGBA',(W,H),(3,10,29,255)); d=ImageDraw.Draw(frame); center(d,'Et si le relief',650,67,WHITE,True); center(d,'cache le Soleil ?',745,67,(255,125,125),True)
 elif t<22.6:
  q=ease((t-20.8)/1.8); frame=cover(imgs['07-search-unfavorable'],1+.035*q,py=.39); caption(frame,'Nouvelle recherche','Chamonix-Mont-Blanc',NAVY,285)
 elif t<24.0:
  frame=cover(imgs['08-loading-unfavorable'],1.025,py=.45); caption(frame,'Le calcul recommence','Même heure, autre horizon',NAVY,118)
 elif t<27.5:
  q=ease((t-24)/3.5); frame=cover(imgs['09-unfavorable-result'],1+.025*q,py=.50); caption(frame,'Défavorable · Soleil masqué','Marge négative malgré une météo correcte',RED,118)
 elif t<30.5:
  q=ease((t-27.5)/3); frame=cover(imgs['10-unfavorable-horizon'],1+.035*q,py=.55); caption(frame,'Ici, le graphique tranche','Le relief dépasse la hauteur du Soleil',RED,118)
 elif t<32.0:
  frame=Image.new('RGBA',(W,H),(247,249,252,255)); d=ImageDraw.Draw(frame); center(d,'Choisissez avant de partir.',590,55,NAVY,True); center(d,'Vérifiez les conditions sur place.',680,37,(75,89,112),False); center(d,'Ne regardez jamais le Soleil sans protection.',750,31,RED,True)
 else:
  frame=Image.new('RGBA',(W,H),NAVY+(255,)); d=ImageDraw.Draw(frame); center(d,'Où voir l’éclipse ?',515,74,WHITE,True); center(d,'La carte est en ligne',625,38,(151,215,255),True); center(d,'cartokob.pages.dev',700,34,WHITE,False)
  lw=430; lh=int(logo.height*lw/logo.width); lg=logo.resize((lw,lh),Image.Resampling.LANCZOS); white=Image.new('RGBA',lg.size,(255,255,255,0)); white.putalpha(lg.getchannel('A')); frame.alpha_composite(white,((W-lw)//2,1030)); center(d,'une création',970,24,MUTED,False)
 p.stdin.write(frame.tobytes())
p.stdin.close(); raise SystemExit(p.wait())
