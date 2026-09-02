"use strict";exports.id=554,exports.ids=[554],exports.modules={7627:(e,t,r)=>{function n(e){}r.d(t,{u:()=>n}),r(7577)},72:(e,t,r)=>{function n(e){return e?e.replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g,"").replace(/&(nbsp|amp|quot|#039|mdash|ldquo|rdquo);/g,(e,t)=>({nbsp:" ",amp:"&",quot:'"',"#039":"'",mdash:"—",ldquo:'"',rdquo:'"'})[t]??" ").replace(/\s+/g," ").trim():""}function o(e){if(!Number.isFinite(e)||e<0)return"0:00";let t=Math.floor(e%60),r=Math.floor(e/60%60),n=Math.floor(e/3600),o=e=>String(e).padStart(2,"0");return n>0?`${n}:${o(r)}:${o(t)}`:`${r}:${o(t)}`}function a(e,t){let r=Math.max(0,t-e);return r<60?"Almost done":`${Math.round(r/60)} min left`}function i(e){if(!e||e<=0)return null;let t=Math.floor(e/86400),r=Math.floor(e%86400/3600);if(t>0)return`Next episode in ${t}d ${r}h`;let n=Math.floor(e%3600/60);return r>0?`Next episode in ${r}h ${n}m`:`Next episode in ${n}m`}function s(e,t){return e||t?[e?e.charAt(0)+e.slice(1).toLowerCase():"",t].filter(Boolean).join(" "):""}r.d(t,{D0:()=>s,Gl:()=>i,MG:()=>o,Vq:()=>a,Vt:()=>n})},2933:(e,t,r)=>{r.d(t,{Z:()=>n});let n=(0,r(2881).Z)("Check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]])},4893:(e,t,r)=>{r.d(t,{Z:()=>n});let n=(0,r(2881).Z)("Play",[["polygon",{points:"6 3 20 12 6 21 6 3",key:"1oa8hb"}]])},4183:(e,t,r)=>{r.d(t,{y:()=>i});var n=r(551),o=r(5251);let a=null,i=(0,n.Ue)()((0,o.tJ)((e,t)=>({progress:[],saved:[],sync:null,preferences:{audio:"sub",subtitleLang:"en",subtitleSize:"medium",autoSkipIntro:!0,autoPlayNext:!0,audioLang:"ja"},recordProgress(r){let n=r.duration>0?r.position/r.duration:0,o=t().progress.filter(e=>!(e.animeId===r.animeId&&e.episode===r.episode));e({progress:n>=.92?o:[{...r,updatedAt:Date.now()},...o].slice(0,40)});let i=t().sync;i&&!a&&(a=setTimeout(()=>{a=null;let e=t();i.push({progress:e.progress,preferences:e.preferences}).catch(()=>{})},15e3))},clearProgress(r){e({progress:t().progress.filter(e=>e.animeId!==r)})},progressFor:(e,r)=>t().progress.find(t=>t.animeId===e&&(void 0===r||t.episode===r)),continueWatching:()=>t().progress.filter(e=>{let t=e.duration>0?e.position/e.duration:0;return t>.02&&t<.92}).sort((e,t)=>t.updatedAt-e.updatedAt),toggleSaved(r){let n=t().saved;e({saved:n.includes(r)?n.filter(e=>e!==r):[r,...n]})},isSaved:e=>t().saved.includes(e),setPreferences(r){e({preferences:{...t().preferences,...r}})},attachSync(t){e({sync:t})},async pullRemote(){let r=t().sync;if(!r)return;let n=await r.pull().catch(()=>null);if(!n)return;let o=new Map;for(let e of[...t().progress,...n.progress]){let t=`${e.animeId}:${e.episode}`,r=o.get(t);(!r||e.updatedAt>r.updatedAt)&&o.set(t,e)}e({progress:[...o.values()].sort((e,t)=>t.updatedAt-e.updatedAt).slice(0,40),preferences:{...t().preferences,...n.preferences}})}}),{name:"animux.library",version:2,storage:(0,o.FL)(()=>localStorage),partialize:e=>({progress:e.progress,saved:e.saved,preferences:e.preferences})}))},8585:(e,t,r)=>{var n=r(1085);r.o(n,"notFound")&&r.d(t,{notFound:function(){return n.notFound}})},1085:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{ReadonlyURLSearchParams:function(){return i},RedirectType:function(){return n.RedirectType},notFound:function(){return o.notFound},permanentRedirect:function(){return n.permanentRedirect},redirect:function(){return n.redirect}});let n=r(3953),o=r(6399);class a extends Error{constructor(){super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams")}}class i extends URLSearchParams{append(){throw new a}delete(){throw new a}set(){throw new a}sort(){throw new a}}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},6399:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{isNotFoundError:function(){return o},notFound:function(){return n}});let r="NEXT_NOT_FOUND";function n(){let e=Error(r);throw e.digest=r,e}function o(e){return"object"==typeof e&&null!==e&&"digest"in e&&e.digest===r}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},8586:(e,t)=>{var r;Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"RedirectStatusCode",{enumerable:!0,get:function(){return r}}),function(e){e[e.SeeOther=303]="SeeOther",e[e.TemporaryRedirect=307]="TemporaryRedirect",e[e.PermanentRedirect=308]="PermanentRedirect"}(r||(r={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},3953:(e,t,r)=>{var n;Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RedirectType:function(){return n},getRedirectError:function(){return u},getRedirectStatusCodeFromError:function(){return g},getRedirectTypeFromError:function(){return f},getURLFromRedirectError:function(){return p},isRedirectError:function(){return c},permanentRedirect:function(){return l},redirect:function(){return d}});let o=r(4580),a=r(2934),i=r(8586),s="NEXT_REDIRECT";function u(e,t,r){void 0===r&&(r=i.RedirectStatusCode.TemporaryRedirect);let n=Error(s);n.digest=s+";"+t+";"+e+";"+r+";";let a=o.requestAsyncStorage.getStore();return a&&(n.mutableCookies=a.mutableCookies),n}function d(e,t){void 0===t&&(t="replace");let r=a.actionAsyncStorage.getStore();throw u(e,t,(null==r?void 0:r.isAction)?i.RedirectStatusCode.SeeOther:i.RedirectStatusCode.TemporaryRedirect)}function l(e,t){void 0===t&&(t="replace");let r=a.actionAsyncStorage.getStore();throw u(e,t,(null==r?void 0:r.isAction)?i.RedirectStatusCode.SeeOther:i.RedirectStatusCode.PermanentRedirect)}function c(e){if("object"!=typeof e||null===e||!("digest"in e)||"string"!=typeof e.digest)return!1;let[t,r,n,o]=e.digest.split(";",4),a=Number(o);return t===s&&("replace"===r||"push"===r)&&"string"==typeof n&&!isNaN(a)&&a in i.RedirectStatusCode}function p(e){return c(e)?e.digest.split(";",3)[2]:null}function f(e){if(!c(e))throw Error("Not a redirect error");return e.digest.split(";",2)[1]}function g(e){if(!c(e))throw Error("Not a redirect error");return Number(e.digest.split(";",4)[3])}(function(e){e.push="push",e.replace="replace"})(n||(n={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},5259:(e,t,r)=>{r.d(t,{NA:()=>i,WI:()=>d,cd:()=>u,q1:()=>l});let n=`
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  popularity
  format
  status
  episodes
  duration
  season
  seasonYear
  genres
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode timeUntilAiring }
  trailer { id site }
`,o=`
  query (
    $search: String, $genre_in: [String], $genre_not_in: [String],
    $seasonYear: Int, $season: MediaSeason, $format_in: [MediaFormat],
    $status: MediaStatus, $averageScore_greater: Int,
    $sort: [MediaSort], $page: Int, $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(
        search: $search, genre_in: $genre_in, genre_not_in: $genre_not_in,
        seasonYear: $seasonYear, season: $season, format_in: $format_in,
        status: $status, averageScore_greater: $averageScore_greater,
        sort: $sort, type: ANIME, isAdult: false
      ) { ${n} }
    }
  }
`,a=`
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${n}
      bannerImage
      relations {
        edges {
          relationType(version: 2)
          node { id type title { romaji english } coverImage { large color } format }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes { mediaRecommendation { ${n} } }
      }
    }
  }
`;class i extends Error{}async function s(e,t,r=3600){let n;try{n=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:e,variables:t}),next:{revalidate:r}})}catch{throw new i("Could not reach the catalogue. Check your connection.")}if(429===n.status)throw new i("The catalogue is rate limiting us. Try again in a moment.");if(!n.ok)throw new i(`The catalogue returned ${n.status}.`);let o=await n.json();if(o.errors?.length)throw new i(o.errors[0]?.message??"The catalogue rejected that request.");return o.data}async function u(e){let t={page:e.page??1,perPage:e.perPage??24,sort:[e.sort??"POPULARITY_DESC"]};return e.search?.trim()&&(t.search=e.search.trim()),e.genres?.length&&(t.genre_in=e.genres),e.excludeGenres?.length&&(t.genre_not_in=e.excludeGenres),e.year&&(t.seasonYear=e.year),e.season&&(t.season=e.season.toUpperCase()),e.formats?.length&&(t.format_in=e.formats),e.status&&(t.status=e.status.toUpperCase()),e.minScore&&(t.averageScore_greater=e.minScore),t.search&&!e.sort&&(t.sort=["SEARCH_MATCH"]),(await s(o,t)).Page}async function d(e){return(await s(a,{id:e},86400)).Media}function l(e){return e.english||e.romaji||e.native||"Untitled"}}};