var app = app || {};

app.main = (function() {
  var socket;

  var socketSetup = function(callback){
    socket = io.connect();

    socket.on('poll-list', function(res) {
      render('index', '#main-container', 'replace', res.polls);
    });

    socket.on('joined-poll', function(res) {
      render('poll', '#main-container', 'replace', {poll: res.poll});
    });

    socket.on('msg-to-clients', function(res) {
      render('vote-item', '#vote-container', 'append', {
        blob: res.blob,
      });
      console.log("BLOOBBB***e" + res.blob);
      var localArray = [];

      function createArr(key, value, index) {
        localArray[index] = {
          key: key,
          value: value
        };
      };

      createArr(res.blob.choiceOne, res.blob.votesOne, 0);
      createArr(res.blob.choiceTwo, res.blob.votesTwo, 1);
      createArr(res.blob.choiceThree, res.blob.votesThree, 2);


      var setup = function(targetID){
                //Set size of svg element and chart
                var margin = {top: 0, right: 0, bottom: 0, left: 0},
                width = 600 - margin.left - margin.right,
                height = 400 - margin.top - margin.bottom,
                categoryIndent = 4*15 + 5,
                defaultBarWidth = 2000;

                //Set up scales
                var x = d3.scale.linear()
                .domain([0,defaultBarWidth])
                .range([0,width]);
                var y = d3.scale.ordinal()
                .rangeRoundBands([0, height], 0.1, 0);

                //Create SVG element
                d3.select(targetID).selectAll("svg").remove()
                var svg = d3.select(targetID).append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                //Package and export settings
                var settings = {
                  margin:margin, width:width, height:height, categoryIndent:categoryIndent,
                  svg:svg, x:x, y:y
                }
                return settings;
              }

              var redrawChart = function(targetID, newdata) {

                //Import settings
                var margin=settings.margin, width=settings.width, height=settings.height, categoryIndent=settings.categoryIndent,
                svg=settings.svg, x=settings.x, y=settings.y;

                //Reset domains
                y.domain(newdata.sort(function(a,b){
                  return b.value - a.value;
                })
                .map(function(d) { return d.key; }));
                var barmax = d3.max(newdata, function(e) {
                  return e.value;
                });
                x.domain([0,barmax]);

                //Bind new data to chart rows

                //Create chart row and move to below the bottom of the chart
                var chartRow = svg.selectAll("g.chartRow")
                .data(newdata, function(d){ return d.key});
                var newRow = chartRow
                .enter()
                .append("g")
                .attr("class", "chartRow")
                .attr("transform", "translate(0," + height + margin.top + margin.bottom + ")");

                //Add rectangles
                newRow.insert("rect")
                .attr("class","bar")
                .attr("x", 0)
                .attr("opacity",0)
                .attr("height", y.rangeBand())
                .attr("width", function(d) { return x(d.value);})

                  //Add value labels
                  newRow.append("text")
                  .attr("class","label")
                  .attr("y", y.rangeBand()/2)
                  .attr("x",0)
                  .attr("opacity",0)
                  .attr("dy",".35em")
                  .attr("dx","0.5em")
                  .text(function(d){return d.value;});

                //Add Headlines
                newRow.append("text")
                .attr("class","category")
                .attr("text-overflow","ellipsis")
                .attr("y", y.rangeBand()/2)
                .attr("x",categoryIndent)
                .attr("opacity",0)
                .attr("dy",".35em")
                .attr("dx","0.5em")
                .text(function(d){return d.key});

                //Update bar widths
                chartRow.select(".bar").transition()
                .duration(300)
                .attr("width", function(d) { return x(d.value);})
                .attr("opacity",1);
                ;
                //Update data labels
                chartRow.select(".label").transition()
                .duration(300)
                .attr("opacity",1)
                .tween("text", function(d) {
                  var i = d3.interpolate(+this.textContent.replace(/\,/g,''), +d.value);
                  return function(t) {
                    this.textContent = Math.round(i(t));
                  };
                });

                //Fade in categories
                chartRow.select(".category").transition()
                .duration(300)
                .attr("opacity",1);


                //Fade out and remove exit elements
                chartRow.exit().transition()
                .style("opacity","0")
                .attr("transform", "translate(0," + (height + margin.top + margin.bottom) + ")")
                .remove();


                var delay = function(d, i) { return 200 + i * 30; };

                chartRow.transition()
                .delay(delay)
                .duration(900)
                .attr("transform", function(d){ return "translate(0," + y(d.key) + ")"; });
              };


              var pullData = function(settings,callback){
               var data = localArray
               var newData = data;
               newData = formatData(newData);
               callback(settings,newData);
             }

              //Sort data in descending order and take the top 10 values
              var formatData = function(data){
                return data.sort(function (a, b) {
                  return b.value - a.value;
                })
                .slice(0, 10);
              }

              var redraw = function(settings){
                pullData(settings,redrawChart)
              }

              //setup (includes first draw)
              var settings = setup('#chart');
              redraw(settings);

            });
}

var hashRouter = function(){
  $(window).off('hashchange').on('hashchange', function() {
    var currentPage = location.hash.substring(2, location.hash.length);
    console.log('Current hash is ' + currentPage);

    if(currentPage === 'index'){
      loadData(currentPage);

    }else if(currentPage.indexOf('/') > -1){
      pollId = currentPage.substring(currentPage.indexOf('/') + 1);
      currentPage = currentPage.substring(0, currentPage.indexOf('/'));
      console.log('Current Page: ' + currentPage);
      console.log('Poll Id: ' + pollId);
      loadData(currentPage, pollId);
    }
  });
}

var loadData = function(template, data){
  console.log('Loading data for: ' + template);
  if(data !== undefined){
    console.log('Data: ' + data);
  }

  socket.emit(template, data);
};

var render = function(template, containerElement, method, data){
  console.log(method + ' ' + template + ' in ' + containerElement);
  if(data !== undefined){
    console.log(data);
  }

  var templateToCompile = $('#tpl-' + template).html();

  var compiled =  _.template(templateToCompile);

  if(method === 'replace'){
    $(containerElement).html(compiled({data: data}));
  }else if(method === 'append'){
    $(containerElement).append(compiled({data: data}));
  }

  var objDiv = document.getElementById("main-container");
  objDiv.scrollTop = objDiv.scrollHeight;

  attachEvents();
};

var attachEvents = function(){
  console.log('Called attachEvents.');

    // new poll submit
    $('#js-btn-create-poll').off('click').on('click', function() {
      console.log('Create poll.');
      createPoll();
    });

    $('#js-btn-vote-radio').off('click').on('click', function() {
      sendVote();
    });
  };

  var createPoll = function(){
    var pollName = $('#js-ipt-poll-name').val();
    var choiceOne = $('#js-ipt-poll-choiceOne').val();
    var choiceTwo = $('#js-ipt-poll-choiceTwo').val();
    var choiceThree = $('#js-ipt-poll-choiceThree').val();
    if(pollName.length > 0){
      socket.emit('create-poll', {pollName: pollName, choiceOne: choiceOne, choiceTwo: choiceTwo, choiceThree: choiceThree});
    }
  }

  var sendVote = function(){
    var ballot = $('#ballot input:radio:checked').val();
    socket.emit('msg-to-server', ballot);
    $('#ballot').remove();
  };

  var init = function(){

    console.log('Initializing app.');

    hashRouter();
    socketSetup();
    attachEvents();
    location.hash = '/index';
  };

  return {
    init: init
  };
})();

window.addEventListener('DOMContentLoaded', app.main.init);

//http://bl.ocks.org/charlesdguthrie/11356441//
