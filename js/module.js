(function(){
  // Cache DOM
  var slides = Array.from(document.querySelectorAll('.slide'));
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');
  var slideNum = document.getElementById('slideNum');
  var slideCount = document.getElementById('slideCount');
  var submitQuiz = document.getElementById('submitQuiz');
  var quizMsg = document.getElementById('quizMsg');
  var actMsg = document.getElementById('actMsg');

  // Counters
  if (slideCount) slideCount.textContent = String(slides.length);

  // Gate flags
  var tfPassed = false;     // slide index 2
  var orderDone = false;    // slide index 4
  var matchDone = false;    // slide index 5

  // Track tap-to-move selection
  var selectedTile = null;

  // SCORM init
  function initSCORM(){
    try {
      LMSInitialize();
      var status = LMSGetValue('cmi.core.lesson_status') || '';
      if (!status || String(status).toLowerCase() === 'not attempted') {
        LMSSetValue('cmi.core.lesson_status','incomplete');
      }
      LMSCommit();
    } catch(e){}
  }

  // Navigation
  var current = 0;
  function showSlide(i){
    slides.forEach(function(s){ s.classList.remove('active'); });
    current = Math.max(0, Math.min(i, slides.length-1));
    slides[current].classList.add('active');
    if (slideNum) slideNum.textContent = String(current+1);
    if (backBtn) backBtn.disabled = (current === 0);
    if (nextBtn) nextBtn.disabled = (current === slides.length-1);
    try {
      LMSSetValue('cmi.core.lesson_location', String(current));
      LMSCommit();
    } catch(e){}
  }
  function restoreLocation(){
    try {
      var loc = LMSGetValue('cmi.core.lesson_location');
      var idx = parseInt(loc, 10);
      if (!isNaN(idx) && idx >=0 && idx < slides.length) return idx;
    } catch(e){}
    return 0;
  }
  function guardNext(){
    // Slide gating:
    // - index 2 (T/F) must be correct
    if (current === 2 && !tfPassed){
      if (actMsg){ actMsg.textContent = 'Please answer correctly to continue.'; actMsg.className='msg warn'; }
      return false;
    }
    // - index 4 (ordering) must be correct
    if (current === 4 && !orderDone){
      var om = document.getElementById('orderMsg');
      if (om){ om.textContent = 'Complete the ordering task before continuing.'; om.className='msg warn'; }
      return false;
    }
    // - index 5 (matching) must be correct
    if (current === 5 && !matchDone){
      var mm = document.getElementById('matchMsg');
      if (mm){ mm.textContent = 'Complete the matching task before continuing.'; mm.className='msg warn'; }
      return false;
    }
    return true;
  }

  // Quiz grading (uses data-correct markers; supports shuffled questions)
  function gradeQuiz(){
    var form = document.getElementById('quizForm');
    if (!form) return;
    var sets = Array.from(form.querySelectorAll('fieldset'));
    var correct = 0, total = sets.length;
    sets.forEach(function(fs){
      var chosen = fs.querySelector('input[type="radio"]:checked');
      if (chosen && chosen.dataset && chosen.dataset.correct === "1") correct++;
    });
    var pct = Math.round((correct/total)*100);
    var passed = pct >= 70;
    if (quizMsg){
      quizMsg.textContent = 'You scored ' + pct + '% (' + correct + ' of ' + total + '). ' + (passed ? 'Status: PASSED' : 'Status: FAILED');
      quizMsg.className = 'msg ' + (passed ? 'ok' : 'warn');
    }
    try {
      LMSSetValue('cmi.core.score.raw', String(pct));
      LMSSetValue('cmi.core.lesson_status', passed ? 'passed' : 'failed');
      LMSCommit();
    } catch(e){}
  }

  // --- Interactions ---
  function initTrueFalseGate(){
    var tfForm = document.getElementById('tfForm');
    if (!tfForm) return;
    tfForm.addEventListener('change', function(){
      var chosen = tfForm.querySelector('input[name="tf1"]:checked');
      if (!chosen) return;
      if (chosen.value === 'false'){ // correct
        tfPassed = true;
        if (actMsg){ actMsg.textContent = 'Correct — you can continue.'; actMsg.className='msg ok'; }
      } else {
        tfPassed = false;
        if (actMsg){ actMsg.textContent = 'That is not correct. Try again.'; actMsg.className='msg warn'; }
      }
    });
  }

  function initFlashcards(){
    var flips = Array.from(document.querySelectorAll('[data-flip]'));
    flips.forEach(function(el){
      el.addEventListener('click', function(){
        el.classList.toggle('show');
      });
    });
  }

  // ------------- Drag & drop helpers (desktop) -------------
  var dragged = null;
  function handleDragStart(e){
    dragged = e.target;
    try{
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    }catch(err){}
  }
  function handleDragOver(e){
    try{ e.preventDefault(); }catch(err){}
    try{ this.classList.add('over'); }catch(err){}
    try{
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    }catch(err){}
  }
  function handleDragLeave(e){
    try{ this.classList.remove('over'); }catch(err){}
  }
  function handleDrop(e){
    try{ e.preventDefault(); }catch(err){}
    try{ this.classList.remove('over'); }catch(err){}
    if(!dragged) return;
    try{ this.appendChild(dragged); }catch(err){}
    dragged = null;
  }

  function makeDropzone(el){
    el.classList.add('dropzone');
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
  }

  // ------------- Tap-to-move helpers (mobile & desktop fallback) -------------

  function handleTileClick(e){
    e.stopPropagation();
    var tile = e.currentTarget;

    // If clicking the same tile again, deselect
    if (selectedTile === tile){
      tile.classList.remove('selected');
      selectedTile = null;
      return;
    }

    // Clear previous selection
    if (selectedTile){
      selectedTile.classList.remove('selected');
    }

    selectedTile = tile;
    tile.classList.add('selected');
  }

  function handleZoneClick(e){
    e.stopPropagation();
    if (!selectedTile) return;
    var zone = e.currentTarget;
    try{
      zone.appendChild(selectedTile);
    }catch(err){}
    selectedTile.classList.remove('selected');
    selectedTile = null;
  }

  function initTapToMove(){
    // Attach click handlers to all current tiles and zones
    var tiles = Array.from(document.querySelectorAll('.draggable'));
    var zones = Array.from(document.querySelectorAll('.dropzone'));

    tiles.forEach(function(t){
      t.addEventListener('click', handleTileClick);
    });
    zones.forEach(function(z){
      z.addEventListener('click', handleZoneClick);
    });
  }

  // ------------- Ordering activity -------------

  function initOrdering(){
    // Turn bank and numbered slots into dropzones
    var bank = document.getElementById('order-bank');
    if (bank) makeDropzone(bank);
    Array.from(document.querySelectorAll('[data-slot]')).forEach(makeDropzone);

    Array.from(document.querySelectorAll('#order-bank .draggable')).forEach(function(el){
      el.addEventListener('dragstart', handleDragStart);
    });

    var btn = document.getElementById('checkOrder');
    if (btn){
      btn.addEventListener('click', function(){
        var seq = [1,2,3,4,5,6].map(function(n){
          var z = document.querySelector('[data-slot="'+n+'"]');
          var child = z ? z.querySelector('.draggable') : null;
          return child ? child.textContent.trim() : '';
        });
        var correct = ["Description","Feelings","Evaluation","Analysis","Conclusion","Action Plan"];
        var ok = JSON.stringify(seq)===JSON.stringify(correct);
        var m = document.getElementById('orderMsg');
        if (m){
          m.textContent = ok
            ? "Correct order — well done!"
            : "Not quite. You can tap or drag tiles between slots or back to the bank and try again.";
          m.className='msg ' + (ok?'ok':'warn');
        }
        orderDone = ok;
      });
    }

    // Optional: shuffle bank tiles each load for variety
    try {
      var tiles = Array.from(document.querySelectorAll('#order-bank .draggable'));
      for (var i = tiles.length - 1; i > 0; i--){
        var j = Math.floor(Math.random()*(i+1));
        bank.appendChild(tiles[j]);
        tiles = Array.from(document.querySelectorAll('#order-bank .draggable'));
      }
    } catch(e){}
  }

  // ------------- Matching activity -------------

  function initMatching(){
    // Make target zones droppable
    Array.from(document.querySelectorAll('section[data-slide="5"] .dropzone')).forEach(makeDropzone);
    // Make bank items draggable
    Array.from(document.querySelectorAll('#match-bank .draggable')).forEach(function(el){
      el.addEventListener('dragstart', handleDragStart);
    });
    // Randomise order of definition pairs
    try {
      var pairs = Array.from(document.querySelectorAll('section[data-slide="5"] .pair'));
      if (pairs.length){
        var wrap = pairs[0].parentElement;
        var shuffled = pairs.slice();
        for (var i = shuffled.length - 1; i > 0; i--){
          var j = Math.floor(Math.random()*(i+1));
          var tmp = shuffled[i]; shuffled[i]=shuffled[j]; shuffled[j]=tmp;
        }
        shuffled.forEach(function(p){ wrap.appendChild(p); });
      }
    } catch(e){}
    // Check button
    var btn = document.getElementById('checkMatch');
    if (btn){
      btn.addEventListener('click', function(){
        var zones = Array.from(document.querySelectorAll('[data-accept]'));
        var total = zones.length, correct=0;
        zones.forEach(function(z){
          var accept = z.getAttribute('data-accept');
          var child = z.querySelector('[data-key]');
          if (child && child.getAttribute('data-key')===accept) correct++;
        });
        var pct = Math.round((correct/total)*100);
        var m = document.getElementById('matchMsg');
        if (m){
          m.textContent = 'You matched ' + correct + ' of ' + total + ' (' + pct + '%).';
          m.className='msg ' + (correct===total?'ok':'warn');
        }
        matchDone = (correct===total);
      });
    }
  }

  // ------------- Quiz randomisation + exit video -------------

  function randomiseQuiz(){
    // Completion on final video (90% watched)
    try {
      var exitVideo = document.getElementById('exitVideo');
      if (exitVideo) {
        exitVideo.addEventListener('timeupdate', function(){
          if (!exitVideo.duration) return;
          var prog = exitVideo.currentTime / exitVideo.duration;
          if (prog > 0.9) {
            try {
              var status = (LMSGetValue('cmi.core.lesson_status') || '').toLowerCase();
              if (status !== 'completed' && status !== 'passed') {
                LMSSetValue('cmi.core.lesson_status','completed');
                LMSCommit();
              }
            } catch(e){}
          }
        });
      }
    } catch(e){}

    try{
      var form = document.getElementById('quizForm');
      if (!form) return;
      var sets = Array.from(form.querySelectorAll('fieldset'));
      // Fisher-Yates shuffle
      for (var i = sets.length - 1; i > 0; i--){
        var j = Math.floor(Math.random()*(i+1));
        var tmp = sets[i]; sets[i]=sets[j]; sets[j]=tmp;
      }
      sets.forEach(function(fs){ form.appendChild(fs); });
    }catch(e){}
  }

  // Init
  function initAll(){
    initSCORM();
    showSlide(restoreLocation());
    // Bind nav
    if (backBtn) backBtn.addEventListener('click', function(){ showSlide(current-1); });
    if (nextBtn) nextBtn.addEventListener('click', function(){ if (!guardNext()) return; showSlide(current+1); });
    // Bind interactions
    initTrueFalseGate();
    initFlashcards();
    initOrdering();
    initMatching();
    if (submitQuiz) submitQuiz.addEventListener('click', gradeQuiz);
    randomiseQuiz();

    // After all dropzones & tiles exist, enable tap-to-move
    initTapToMove();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
