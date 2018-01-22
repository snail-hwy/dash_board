
var data = {
  title: '考试分数',
  id: 'canvas',
  width: 400, //【微信小程序】需传此参数
  height: 600, //【微信小程序】需传此参数
  plate_angle: 230, //表盘的总度数
  // division_score: 5, //分度值（最小刻度范围）

  min_score: 0, //最小分数
  max_score: 100, //最大分数
  score: 85, //真实分数
  decimals_num: 0, //小数位数，至多保留1位小数

  level_score: 100, //每个等级的分数差（等级分数均匀时才需传此参数）  
  score_list: [0, 60, 80, 90, 100], //level_score和score_list，均分时只需传level_score，非均分时只需传score_list
  level_list: ['不及格', '普通', '良好', '优秀'],
  color_list: ['#2fc1ff', '#35ff27', '#ffff0b', '#fd7407', '#fd0006'],
}

function display(data){
  //创建画布--非【微信小程序】
  var canvas = document.getElementById(data.id);
  var width = canvas.width;
  var height = canvas.height;
  var ctx = canvas.getContext('2d');

  //创建画布--【微信小程序】
  // var width = data.width || 400
  // var height = data.height || 600
  // const ctx = wx.createCanvasContext(data.id)

  //表盘设置
  var plate_angle = data.plate_angle || 220; //整个盘的度数
  var plate_rad = (Math.PI / 180) * plate_angle; //整个盘的弧度
  var diff_rad = (plate_rad - Math.PI) / 2; //表盘左右两边相对于原x轴的角度 (即被x轴切出来的两个小扇形的角度)
  var path_radius = data.path_radius || (width * 3 / 8); //圆点移动轨道的半径值
  var scale_radius = data.scale_radius || (path_radius - 10); //刻度显示层外圈半径值
  var text_radius = data.text_radius || (path_radius - 35);; //坐标数值圈的半径

  //分数相关
  var min_score = data.min_score || 0; //起始值
  var max_score = data.max_score || 100; //终止值
  var score_range = max_score - min_score; //分数范围
  var real_score = data.score //真实分数
  if (real_score < min_score || real_score > max_score || score_range <= 0) {
    return warn('输入分数错误');
  } 
  var rad_of_1score = plate_rad / score_range;  //分数1对应的弧度
  var score_of_1rad = score_range / plate_rad; //弧度1对应的分数
  var decimals_num = data.decimals_num || 0
  var decimals_pow = Math.pow(10, decimals_num);

  //刻度相关
  var score_list = data.score_list || [];
  var level_list = data.level_list || [];
  var color_list = data.color_list || [];

  //level_score 和 score_list 只需传1个，优先取score_list
  if(score_list.length < 2){ //列表里至少包含最小、最大分数
    score_list = []
    var level_score = data.level_score || 10
    for(var i=min_score; i<max_score; i=i+level_score){
      score_list.push(Math.floor(i*decimals_pow)/decimals_pow);
    }
    score_list.push(max_score); //不一定整除，故max_score单独push
  }
  if(score_list[0] != min_score){
    return warn('列表第一个分数必须等于最小分数');
  }
  if(score_list[score_list.length - 1] != max_score){
    return warn('列表最后一个分数必须等于最大分数');
  }
  for (var i = 1; i < score_list.length; i++) {
    if(score_list[i] <= score_list[i-1]){
      return warn('列表后一个分数必须大于前一个分数');
    }
  }

  var level_num = score_list.length - 1 //级别总数

  //每个大刻度的总弧度
  var rad_list = []
  for (var i = 0; i < score_list.length; i++) {
    var tmp_rad = (score_list[i] - min_score) * rad_of_1score
    rad_list.push(tmp_rad)
  }

  //level_list不足时补空字符
  var tmp_level_list = []
  for(var i = 0; i < level_num; i++){
    var tmp_level = level_list[i] != undefined ? level_list[i] : ''
    tmp_level_list.push(tmp_level)
  }
  level_list = tmp_level_list //覆盖

  //color_list不足时补空字符
  var tmp_color_list = []
  for(var i = 0; i < level_num; i++){
    var tmp_color = color_list[i] != undefined ? color_list[i] : ''
    tmp_color_list.push(tmp_color)
  }
  color_list = tmp_color_list //覆盖

  //分度值
  var division_score = data.division_score || score_range
  if(division_score <= 0){
    division_score = score_range; //此时不显示小刻度
  }
  var division_num = Math.ceil(score_range / division_score) //小刻度线总数
  var division_rad = division_score * rad_of_1score //小刻度的弧度

  console.log(score_list)
  console.log(rad_list) //rad_list 和 score_list 长度相等
  console.log(level_list) //level_list 长度比 score_list长度 少1

  var dot = new Dot(),
      dot_speed = 0.02, //动点的速度(弧度)
      max_loop = 500,
      now_loop = 0,
      score_speed = dot_speed * score_of_1rad,
      real_rad = (real_score - min_score) * rad_of_1score, //动点最终停止的弧度
      now_rad = 0, //当前动点的弧度
      now_score = min_score; //当前显示的分数

  (function refresh() {
    ctx.restore(); //每次先重置

    //每次重画前的准备工作(重新设置原点位置，并旋转坐标系)
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width / 2, height / 2); //把画布的(0,0)坐标点迁移至圆盘的中心点，方便之后操作。
    ctx.rotate(Math.PI - diff_rad); //每次刷新时，先顺时针旋转画布，使表盘的起始点落在x轴的正半轴上(即y=0, x>0)。

    //重画动点
    dot.x = path_radius * Math.cos(now_rad);
    dot.y = path_radius * Math.sin(now_rad);
    dot.draw(ctx);

    //重画分数
    var show_score = now_score 
    if(now_score != real_score){
      //非最终的real_score值时，如果小数尾部带的0也正常显示，否则过程中每次去掉0导致显示数字严重闪烁
      show_score = now_score.toFixed(decimals_num) ;
    }
    show(show_score);

    //圆点已经走过的轨道高亮显示
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
    ctx.arc(0, 0, path_radius, 0, now_rad, false);
    ctx.stroke();
    ctx.restore();

    //动点弧度递增
    if (now_rad <= real_rad - dot_speed) {
      now_rad += dot_speed;
    }else{
      now_rad = real_rad //最后部分一步到位
    }

    //显示分数递增
    // console.log(now_loop, score_speed, now_score)
    if (now_score <= real_score - score_speed) {
      now_score += score_speed;
    } else{
      now_score = real_score; //最后部分一步到位
    }

    //【中间半透明的刻度线层--单种颜色】
    /*
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, .2)';
    ctx.lineWidth = 10;
    ctx.arc(0, 0, scale_radius-5, 0, plate_rad, false);
    ctx.stroke();
    ctx.restore();
    */

    //【中间半透明的刻度线层--多种颜色】
    ctx.save()
    ctx.lineWidth = 10;
    for (var i = 0; i < level_num; i++) {
      ctx.beginPath();
      ctx.strokeStyle = my_rgba(color_list[i], "0.8");
      ctx.arc(0, 0, scale_radius-5, rad_list[i], rad_list[i+1], false);
      ctx.stroke();
    }
    ctx.restore();
    
    //【大刻度线】
    for (var i = 0; i < level_num+1; i++) {
      ctx.save();
      ctx.rotate(rad_list[i]);
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, .3)';
      ctx.moveTo(scale_radius, 0);
      ctx.lineTo(scale_radius-10, 0); //10刻度长度
      ctx.stroke();
      ctx.restore();
    }

    //【小刻度线】
    ctx.save(); 
    for (i = 0; i < division_num; i++) {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, .2)';
      ctx.moveTo(scale_radius, 0);
      ctx.lineTo(scale_radius-7, 0); //7刻度长度
      ctx.stroke();
      ctx.rotate(division_rad);
    }
    ctx.restore();

    //【大刻度对应的分数值】
    ctx.save();
    ctx.rotate(Math.PI / 2); //旋转90度，使表盘的起始点落在y轴的负半轴上(即x=0, y<0)
    var real_level = ''
    var real_color = ''
    for (i = 0; i < level_num+1; i++) {
      ctx.save()
      ctx.rotate(rad_list[i]);
      ctx.fillStyle = 'rgba(255, 255, 255, .5)';
      ctx.font = '10px Microsoft yahei';
      ctx.textAlign = 'center';
      var score_tmp = score_list[i]
      ctx.fillText(score_tmp, 0, -text_radius);
      if(real_score >= score_tmp){
        real_level = level_list[i]
        real_color = color_list[i]
      }
      ctx.restore();
    }
    ctx.restore();

    //【大的刻度段的level】
    ctx.save();
    ctx.rotate(Math.PI / 2); //旋转90度，使表盘的起始点落在y轴的负半轴上(即x=0, y<0)
    for (i = 0; i < level_num; i++) {
      ctx.save();
      var tmp_rad = (rad_list[i+1] + rad_list[i])/2 //继续旋转，使类型名在大分段中间
      ctx.rotate(tmp_rad);
      ctx.fillStyle = 'rgba(255, 255, 255, .7)';
      ctx.font = '10px Microsoft yahei';
      ctx.textAlign = 'center';
      ctx.fillText(level_list[i], 5, -text_radius);
      ctx.restore();
    }
    ctx.restore();

    //【正中间展示实际level】
    ctx.save();
    ctx.rotate(Math.PI + diff_rad); //坐标轴旋转回默认的位置，此时x轴指向东
    // ctx.fillStyle = '#fff';
    ctx.fillStyle = my_rgba(real_color, "0.8");
    ctx.font = '28px Microsoft yahei';
    ctx.textAlign = 'center';
    ctx.fillText(real_level, 0 , 40);

    // 【标题】
    ctx.fillStyle = '#FF6699';
    ctx.font = '18px Microsoft yahei';
    ctx.fillText(data.title, 0, -60);
    ctx.restore();

    //【最外层圆点运行的轨道】
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, .4)';
    ctx.lineWidth = 3;
    ctx.arc(0, 0, path_radius, 0, plate_rad, false);
    ctx.stroke();
    ctx.restore();

    now_loop ++
    // var raf = window.requestAnimationFrame(refresh);
    var st = setTimeout(refresh, 16);//【微信小程序】
    if(now_score > real_score || now_loop > max_loop){ //不要用 >=
      // window.cancelAnimationFrame(raf)
      clearTimeout(st)//【微信小程序】
    }
  })();

  //【轨道上的移动圆点】
  function Dot() {
    this.x = 0;
    this.y = 0;
    this.draw = function (ctx) {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, .7)';
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2, false); //画一个小圆
      ctx.fill();
      ctx.restore();
    };
  }

  //【分数变动显示】
  function show(score) {
    ctx.save();
    ctx.rotate(Math.PI + diff_rad); //坐标轴旋转回默认的位置，此时x轴指向东
    ctx.fillStyle = '#222';
    ctx.font = '60px Microsoft yahei';
    ctx.textAlign = 'center';
    ctx.textBaseLine = 'top';
    ctx.fillText(score, 0 ,10);
    ctx.restore();
  }

  function warn(msg){
    console.log(msg)
    alert(msg)
  }
}//display

display(data)

function my_rgba(hex, opacity) {
    if( ! /#?[\da-f]+/g.test(hex) ) return hex; //如果是“red”格式的颜色值，则不转换。//正则错误，参考后面的PS内容
    var h = hex.charAt(0) == "#" ? hex.substring(1) : hex,
        r = parseInt(h.substring(0,2),16),
        g = parseInt(h.substring(2,4),16),
        b = parseInt(h.substring(4,6),16),
        a = opacity;
    var rgba = "rgba(" + r + "," + g + "," + b + "," + a + ")";
    return rgba
} //my_rgba

