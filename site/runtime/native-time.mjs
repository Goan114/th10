export class NativeTime {
 constructor({timezoneMinutes,now=Date.now,monotonic=()=>performance.now()/1000}={}){this.timezoneMinutes=timezoneMinutes;this.now=now;this.monotonic=monotonic;}
 bind(memory){this.memory=memory;return this;}
 localDate(timestamp,pointer){
  const fixed=Number.isFinite(this.timezoneMinutes),date=new Date((timestamp|0)*1000-(fixed?this.timezoneMinutes*60000:0));
  const part=name=>date[fixed?'getUTC'+name:'get'+name](),year=part('FullYear'),month=part('Month'),day=part('Date');
  const values=[part('Seconds'),part('Minutes'),part('Hours'),day,month,year-1900,part('Day'),Math.round((Date.UTC(year,month,day)-Date.UTC(year,0,1))/86400000),0];
  const view=new DataView(this.memory.buffer);values.forEach((value,i)=>view.setInt32(pointer+i*4,value,true));
 }
 imports(){return {local_date:(timestamp,pointer)=>this.localDate(timestamp,pointer),timestamp:()=>Math.floor(this.now()/1000)|0,monotonic:()=>this.monotonic()};}
}
