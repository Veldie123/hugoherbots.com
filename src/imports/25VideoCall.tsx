import svgPaths from "./svg-ruokijixkh";
import img25VideoCall from "figma:asset/38412790948fe6e6d7d292ef4437f5b27313db03.png";
import imgRectangle from "figma:asset/298afa2bb21e2c3ed37eaddfdc72183ab9d87a5e.png";

function Battery() {
  return (
    <div className="absolute inset-[39.39%_3.91%_34.85%_89.6%]" data-name="Battery">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 26 13">
        <g id="Battery">
          <rect height="10.9776" id="Border" opacity="0.35" rx="2.30176" stroke="var(--stroke-0, white)" strokeWidth="1.06235" width="22.3094" x="0.531177" y="0.531177" />
          <path d={svgPaths.p30390680} fill="var(--fill-0, white)" id="Cap" opacity="0.4" />
          <rect fill="var(--fill-0, white)" height="7.79059" id="Capacity" rx="1.41647" width="19.1224" x="2.12471" y="2.12471" />
        </g>
      </svg>
    </div>
  );
}

function TimeStyle() {
  return (
    <div className="absolute contents left-[22.31px] right-[317.4px] top-[calc(50%+1.27px)] translate-y-[-50%]" data-name="Time Style">
      <p className="absolute font-['SF_Pro_Text:Semibold',sans-serif] leading-[normal] left-[22.31px] not-italic right-[317.4px] text-[15.935px] text-center text-white top-[calc(50%-8.52px)] tracking-[-0.3187px]">9:41</p>
    </div>
  );
}

function BarsStatusOnLight() {
  return (
    <div className="absolute inset-[0_0_94.58%_0]" data-name="Bars/Status/On Light">
      <Battery />
      <div className="absolute inset-[39.39%_11.74%_35.69%_84.19%]" data-name="Wifi">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17 12">
          <path d={svgPaths.p35079e00} fill="var(--fill-0, white)" id="Wifi" />
        </svg>
      </div>
      <div className="absolute inset-[40.15%_17.16%_35.61%_78.31%]" data-name="Cellular Connection">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19 12">
          <path d={svgPaths.p237a880} fill="var(--fill-0, white)" id="Cellular Connection" />
        </svg>
      </div>
      <TimeStyle />
    </div>
  );
}

function BarsHomeIndicatorBlack() {
  return (
    <div className="absolute inset-[95.81%_0_0_0]" data-name="Bars / Home Indicator / Black">
      <div className="absolute bg-white bottom-[8.62px] h-[5.312px] left-[calc(50%-0.72px)] opacity-30 rounded-[106.235px] translate-x-[-50%] w-[143.418px]" data-name="Line" />
    </div>
  );
}

function Avatar() {
  return (
    <div className="absolute contents inset-[9.73%_45.87%_84.48%_5.33%] not-italic text-nowrap text-white" data-name="Avatar">
      <p className="absolute font-['SF_UI_Display:Bold',sans-serif] leading-[29.746px] left-[5.33%] right-[45.87%] text-[25.496px] top-[calc(50%-347.39px)] tracking-[0.2914px]">Catherine Lynch</p>
      <p className="absolute font-['SF_UI_Display:Regular',sans-serif] leading-[19.122px] left-[21.25px] text-[13.811px] top-[114.73px] tracking-[0.34px]">02:35</p>
    </div>
  );
}

function SwitchCamera() {
  return (
    <div className="absolute inset-[84.48%_34.67%_12.81%_57.33%]" data-name="switch-camera-5147">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 24">
        <g id="switch-camera-5147">
          <path clipRule="evenodd" d={svgPaths.p2ce1980} fill="var(--fill-0, white)" fillRule="evenodd" id="Shape" />
        </g>
      </svg>
    </div>
  );
}

function IconsClose() {
  return (
    <div className="absolute inset-[83.99%_11.73%_12.32%_80.27%]" data-name="Icons / Close">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="Icons / Close">
          <path clipRule="evenodd" d={svgPaths.p14ad3880} fill="var(--fill-0, white)" fillRule="evenodd" id="Shape" />
          <mask height="22" id="mask0_628_220" maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }} width="22" x="5" y="5">
            <path clipRule="evenodd" d={svgPaths.p14ad3880} fill="var(--fill-0, white)" fillRule="evenodd" id="Shape_2" />
          </mask>
          <g mask="url(#mask0_628_220)"></g>
        </g>
      </svg>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents inset-[81.65%_6.67%_5.67%_6.67%]" data-name="Group">
      <p className="absolute font-['SF_UI_Display:Regular',sans-serif] leading-[21.247px] left-[244.87px] not-italic text-[13.811px] text-center text-nowrap text-white top-[791.45px] tracking-[0.2946px] translate-x-[-50%]">Flip</p>
      <p className="absolute font-['SF_UI_Display:Regular',sans-serif] leading-[21.247px] left-[335.7px] not-italic text-[13.811px] text-center text-nowrap text-white top-[791.45px] tracking-[0.2946px] translate-x-[-50%]">End</p>
      <p className="absolute font-['SF_UI_Display:Regular',sans-serif] leading-[21.247px] left-[62.68px] not-italic text-[13.811px] text-center text-nowrap text-white top-[792.52px] tracking-[0.2946px] translate-x-[-50%]">Effects</p>
      <div className="absolute inset-[81.65%_75.2%_9.98%_6.67%]" data-name="Oval">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 73 73">
          <path clipRule="evenodd" d={svgPaths.p3d630580} fill="var(--fill-0, white)" fillOpacity="0.2" fillRule="evenodd" id="Oval" />
        </svg>
      </div>
      <div className="absolute inset-[81.65%_52.27%_9.98%_29.6%]" data-name="Oval Copy">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 73 73">
          <path clipRule="evenodd" d={svgPaths.p3d630580} fill="var(--fill-0, white)" fillOpacity="0.2" fillRule="evenodd" id="Oval" />
        </svg>
      </div>
      <div className="absolute inset-[81.65%_29.6%_9.98%_52.27%]" data-name="Oval Copy 2">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 73 73">
          <path clipRule="evenodd" d={svgPaths.p3d630580} fill="var(--fill-0, white)" fillOpacity="0.2" fillRule="evenodd" id="Oval" />
        </svg>
      </div>
      <SwitchCamera />
      <div className="absolute inset-[81.65%_6.67%_9.98%_75.2%]" data-name="Oval Copy 3">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 73 73">
          <path clipRule="evenodd" d={svgPaths.p3d630580} fill="var(--fill-0, #F83D39)" fillRule="evenodd" id="Oval Copy 3" />
        </svg>
      </div>
      <IconsClose />
      <div className="absolute inset-[84.36%_59.46%_12.64%_36.53%]" data-name="Mic off Icon">
        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 26">
          <path d={svgPaths.p16479700} fill="var(--fill-0, white)" id="Mic off Icon" />
        </svg>
      </div>
      <p className="absolute font-['SF_UI_Display:Regular',sans-serif] leading-[21.247px] left-[154.57px] not-italic text-[13.811px] text-center text-nowrap text-white top-[792.52px] tracking-[0.2946px] translate-x-[-50%]">Mute</p>
    </div>
  );
}

function Profiles() {
  return (
    <div className="absolute contents inset-[9.73%_6.67%_5.67%_5.33%]" data-name="Profiles">
      <Avatar />
      <Group />
    </div>
  );
}

function ScreenBrightness() {
  return (
    <div className="absolute inset-[83.99%_80.35%_12.35%_11.73%]" data-name="screen-brightness">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 32 32">
        <g id="screen-brightness">
          <path clipRule="evenodd" d={svgPaths.p3942ca80} fill="var(--fill-0, white)" fillRule="evenodd" id="Shape" />
        </g>
      </svg>
    </div>
  );
}

export default function Component25VideoCall() {
  return (
    <div className="bg-white overflow-clip relative rounded-[25px] size-full" data-name="25_Video Call">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <img alt="" className="absolute max-w-none object-50%-50% object-cover size-full" src={img25VideoCall} />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 36.853%), linear-gradient(rgba(0, 0, 0, 0.1) 65.829%, rgba(0, 0, 0, 0.6) 99.913%)" }} />
      </div>
      <div className="absolute flex inset-[0_0_68.6%_0] items-center justify-center">
        <div className="flex-none h-[270.9px] scale-y-[-100%] w-[398.382px]">
          <div className="bg-gradient-to-b from-[28.637%] from-[rgba(0,0,0,0)] size-full to-[rgba(0,0,0,0.576)]" data-name="transparent copy" />
        </div>
      </div>
      <div className="absolute backdrop-blur-[25.99px] backdrop-filter bg-[rgba(55,55,55,0.3)] inset-[75.99%_0_0_0] rounded-tl-[16.998px] rounded-tr-[16.998px]" data-name="bg copy" />
      <div className="absolute bg-[#d8d8d8] inset-[77.22%_44%_22.29%_44.27%] opacity-30 rounded-[2.125px]" data-name="Rectangle" />
      <BarsStatusOnLight />
      <BarsHomeIndicatorBlack />
      <Profiles />
      <div className="absolute inset-[9.73%_5.33%_79.19%_70.67%] rounded-[8.499px] shadow-[0px_10.624px_21.247px_0px_rgba(0,0,0,0.1)]" data-name="Rectangle">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none rounded-[8.499px] size-full" src={imgRectangle} />
      </div>
      <ScreenBrightness />
    </div>
  );
}