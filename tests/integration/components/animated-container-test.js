import { moduleForComponent, test, skip } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';
import Ember from 'ember';
import { equalBounds, visuallyConstant } from '../../helpers/assertions';
import Motion from 'ember-animated/motion';
import {
  macroWait,
  waitForAnimations
} from 'ember-animated/test-helpers';


moduleForComponent('animated-container', 'Integration | Component | animated container', {
  integration: true,
  beforeEach(assert) {
    assert.equalBounds = equalBounds;
    assert.visuallyConstant = visuallyConstant;
    let here = this;
    this.waitForAnimations = waitForAnimations;
    this.register('component:grab-container', Ember.Component.extend({
      tagName: '',
      didReceiveAttrs() {
        here.set('grabbed', this.get('cont'));
      }
    }));
  }
});

test('simple render', function(assert) {
  this.render(hbs`
    {{#animated-container as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  this.$('.inside').css({
    height: 210
  });

  let container = bounds(this.$('.animated-container'));
  let inside = bounds(this.$('.inside'));
  assert.equalBounds(container, inside, 'takes size of content');

  this.$('.inside').css({
    height: 600
  });

  container = bounds(this.$('.animated-container'));
  let tallerInside = bounds(this.$('.inside'));
  assert.equalBounds(container, tallerInside, 'adapts to height of content');
  assert.ok(tallerInside.height > inside.height, "inside content got taller");

});

test('locks size', function(assert) {
  this.render(hbs`
    {{#animated-container as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  this.$('.inside').css({
    height: 210
  });

  let original = bounds(this.$('.animated-container'));

  Ember.run(() => {
    this.get('grabbed.lock')();
  });

  this.$('.inside').css({
    height: 600
  });

  let final = bounds(this.$('.animated-container'));

  assert.equalBounds(final, original, 'height can be locked');
});

test('measures at the appropriate time', function(assert) {
  let insideBounds;
  let motionSawHeight;

  this.set('TestMotion', class extends Motion {
    *animate() {
      motionSawHeight = this.sprite.finalBounds.height;
    }
  });

  this.render(hbs`
    {{#animated-container motion=TestMotion as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  this.$('.inside').css({
    height: 210
  });

  Ember.run(() => {
    this.get('grabbed.lock')();
  });

  // Deliberately waiting a bit to make sure the container doesn't
  // jump the gun and measure too soon.
  return macroWait().then(() => {

    this.$('.inside').css({
      height: 600
    });

    insideBounds = bounds(this.$('.inside'));

    this.get('grabbed.measure')();
    this.get('grabbed.unlock')();
    return this.waitForAnimations();
  }).then(() => {
    assert.equal(motionSawHeight, insideBounds.height);
  });
});

test('unlocks only after motion is done', function(assert) {
  let finishMotion;

  this.set('TestMotion', class extends Motion {
    *animate() {
      yield new Ember.RSVP.Promise(resolve => {
        finishMotion = resolve;
      });
    }
  });

  this.render(hbs`
    {{#animated-container motion=TestMotion as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  this.$('.inside').css({
    height: 200
  });

  let beforeHeight = height(this.$('.inside'));
  let afterHeight;

  Ember.run(() => {
    this.get('grabbed.lock')();

    this.$('.inside').css({
      height: 400
    });

    afterHeight = height(this.$('.inside'));

    this.get('grabbed.measure')();
    this.get('grabbed.unlock')();
  });
  return macroWait().then(() => {
    assert.equal(height(this.$('.animated-container')), beforeHeight, "still at previous height");
    finishMotion();
    return this.waitForAnimations();
  }).then(() => {
    assert.equal(height(this.$('.animated-container')), afterHeight, "now at final height");
  });
});

test('unlocks only after unlock message is received', function(assert) {
  this.set('TestMotion', class extends Motion {
    *animate() {}
  });

  this.render(hbs`
    {{#animated-container motion=TestMotion as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  this.$('.inside').css({
    height: 200
  });

  let beforeHeight = height(this.$('.inside'));

  Ember.run(() => {
    this.get('grabbed.lock')();
  });

  this.$('.inside').css({
    height: 400
  });

  let afterHeight = height(this.$('.inside'));

  Ember.run(() => {
    this.get('grabbed.measure')();
  });

  return macroWait().then(() => {
    assert.equal(height(this.$('.animated-container')), beforeHeight, "still at previous height");
    this.get('grabbed.unlock')();
    return macroWait();
  }).then(() => {
    assert.equal(height(this.$('.animated-container')), afterHeight, "now at final height");
  });
});

test('passes provided options to motion', function(assert) {
  let motionOpts;
  this.set('TestMotion', class extends Motion {
    *animate() {
      motionOpts = this.opts;
    }
  });

  this.render(hbs`
    {{#animated-container motion=TestMotion as |container|}}
      <div class="inside">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  Ember.run(() => {
    this.get('grabbed.lock')();
  });

  return macroWait().then(() => {
    this.get('grabbed.measure')({ duration: 500 });
    this.get('grabbed.unlock')();
    return this.waitForAnimations();
  }).then(() => {
    assert.deepEqual(motionOpts, { duration: 500 });
  });
});

test('can animate initial render', function(assert) {
  let staticHeight, finalHeight, motionRan;

  this.set('TestMotion', class extends Motion {
    *animate() {
      assert.ok(staticHeight > 0, 'we should have a static height');
      assert.equal(this.sprite.initialBounds.height, 0, 'initial height');
      assert.equal(this.sprite.finalBounds.height, staticHeight, 'final height');
      motionRan = true;
    }
  });

  // This component simulates what animated-each does: the initial
  // lock happens before our container has any DOM, and then the measure happens right at didRender.
  this.register('component:test-child', Ember.Component.extend({
    didReceiveAttrs() {
      this.get('cont.lock')();
    },
    didRender() {
      staticHeight = height(this.$('.inner'));
      this.get('cont.measure')();
      this.$('.inner').css('height', 200);
      finalHeight = height(this.$('.inner'));
      this.get('cont.unlock')();
    }
  }));

  this.render(hbs`
    {{#animated-container motion=TestMotion onInitialRender=true as |container|}}
      {{#test-child cont=container}}
        <div class="inner" style="height: 100px"></div>
      {{/test-child}}
    {{/animated-container}}
  `);

  return this.waitForAnimations().then(() => {
    assert.equal(height(this.$('.animated-container')), finalHeight, 'ends up unlocked');
    assert.ok(motionRan, 'motion ran');
  });
});

test('locks on initial render even when not animating', function(assert) {
  let unlock, staticHeight, finalHeight, motionRan;

  this.set('TestMotion', class extends Motion {
    *animate() {
      motionRan = true;
    }
  });

  // This component simulates what animated-each does: the initial
  // lock happens before our container has any DOM, and then the measure happens right at didRender.
  this.register('component:test-child', Ember.Component.extend({
    didReceiveAttrs() {
      this.get('cont.lock')();
    },
    didRender() {
      staticHeight = height(this.$('.inner'));
      this.get('cont.measure')();
      this.$('.inner').css('height', 200);
      finalHeight = height(this.$('.inner'));

      unlock = this.get('cont.unlock');
    }
  }));

  this.render(hbs`
    {{#animated-container motion=TestMotion as |container|}}
      {{#test-child cont=container}}
        <div class="inner" style="height: 100px"></div>
      {{/test-child}}
    {{/animated-container}}
  `);

  return macroWait().then(() => {
    assert.equal(height(this.$('.animated-container')), staticHeight, 'gets locked');
    unlock();
    return this.waitForAnimations();
  }).then(() => {
    assert.equal(height(this.$('.animated-container')), finalHeight, 'ends up unlocked');
    assert.ok(!motionRan, 'motion did not run');
  });
});


test("Accounts for top margin collapse between self and child", function(assert) {
  this.render(hbs`
    {{#animated-container as |container|}}
      <div class="inside" style="margin-top: 10px; height: 100px;">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  assert.visuallyConstant(this.$('.animated-container'), () => {
    this.get('grabbed.lock')();
    this.$('.inside').css('position', 'absolute');
  });
});

test("Accounts for top margin collapse between self and descendant", function(assert) {
  this.render(hbs`
    {{#animated-container as |container|}}
      <div class="inside">
        <div style="margin-top: 10px; height: 100px;"></div>
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  assert.visuallyConstant(this.$('.animated-container'), () => {
    this.get('grabbed.lock')();
    this.$('.inside').css('position', 'absolute');
  });
});

test("No top margin collapse when we have a border", function(assert) {
  this.render(hbs`
    {{#animated-container style="border: 1px solid black" as |container|}}
      <div class="inside" style="margin-top: 10px; height: 100px;">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  assert.visuallyConstant(this.$('.animated-container'), () => {
    this.get('grabbed.lock')();
    this.$('.inside').css('position', 'absolute');
  });
});

test("No top margin collapse when our margin already exceeds child's", function(assert) {
  this.render(hbs`
    {{#animated-container style="margin-top: 11px" as |container|}}
      <div class="inside" style="margin-top: 10px; height: 100px;">
        {{grab-container cont=container}}
      </div>
    {{/animated-container}}
  `);

  assert.visuallyConstant(this.$('.animated-container'), () => {
    this.get('grabbed.lock')();
    this.$('.inside').css('position', 'absolute');
  });
});


test("Accounts for bottom margin collapse between self and child", function(assert) {
  this.render(hbs`
    <div style="border: 1px solid black">
      {{#animated-container as |container|}}
        <div class="inside" style="margin-bottom: 10px; height: 100px;">
          {{grab-container cont=container}}
        </div>
      {{/animated-container}}
      <div class="after">This comes after</div>
    </div>
  `);

  assert.visuallyConstant(this.$('.after'), () => {
    this.get('grabbed.lock')();
    this.$('.inside').css('position', 'absolute');
  });
});


skip("Accounts for own margin collapse as first content appears", function(assert) {
  let resolveMotion;
  let motion = new Ember.RSVP.Promise(resolve => {
    resolveMotion = resolve;
  });
  this.set('TestMotion', class extends Motion {
    *animate() {
      this.sprite.applyStyles({
        width: this.sprite.finalBounds.width,
        height: this.sprite.finalBounds.height
      });
      resolveMotion();
    }
  });

  this.render(hbs`
    <style type="text/css">
      .example {
        margin-top: 10px;
        margin-bottom: 20px;
      }
    </style>
    {{#animated-container class="example" motion=TestMotion as |container|}}
      <div class="inside" style="height: 0px"></div>
      {{grab-container cont=container}}
    {{/animated-container}}
    <div class="after">This comes after</div>
  `);

  assert.visuallyConstant(this.$('.animated-container'), () => {
    assert.visuallyConstant(this.$('.after'), () => {
      this.get('grabbed.lock')();
      this.$('.inside').css('height', '100px');
    }, 'after bounds');
  }, 'container bounds');

  this.get('grabbed.measure')();

  return motion.then(() => {
    let bounds = this.$('.animated-container')[0].getBoundingClientRect();
    let afterBounds = this.$('.after')[0].getBoundingClientRect();
    this.get('grabbed.unlock')();
    return macroWait().then(() => {
      let newBounds = this.$('.animated-container')[0].getBoundingClientRect();
      let newAfterBounds = this.$('.after')[0].getBoundingClientRect();
      assert.equalBounds(newBounds, bounds, 'bounds check during unlock');
      assert.equalBounds(newAfterBounds, afterBounds, 'after bounds check during unlock');
    });
  });
});

skip("Accounts for own margin collapse as last content is removed", function(assert) {
  let resolveMotion, after;
  let motion = new Ember.RSVP.Promise(resolve => {
    resolveMotion = resolve;
  });
  this.set('TestMotion', class extends Motion {
    *animate() {
      let top = after[0].getBoundingClientRect().top;
      this.sprite.applyStyles({
        width: this.sprite.finalBounds.width,
        height: this.sprite.finalBounds.height
      });
      assert.equal(after[0].getBoundingClientRect().top, top - 1, 'only changes by one pixel');
      resolveMotion();
    }
  });

  this.render(hbs`
    <style type="text/css">
      .example {
        margin-top: 10px;
        margin-bottom: 20px;
      }
    </style>
    {{#animated-container class="example" motion=TestMotion as |container|}}
      <div class="inside" style="height: 1px"></div>
      {{grab-container cont=container}}
    {{/animated-container}}
    <div class="after">This comes after</div>
  `);

  after = this.$('.after');

  assert.visuallyConstant(this.$('.animated-container'), () => {
    assert.visuallyConstant(this.$('.after'), () => {
      this.get('grabbed.lock')();
      this.$('.inside').css('height', 0);
    }, 'after bounds');
  }, 'container bounds');

  this.get('grabbed.measure')();

  return motion.then(() => {
    let bounds = this.$('.animated-container')[0].getBoundingClientRect();
    let afterBounds = this.$('.after')[0].getBoundingClientRect();
    this.get('grabbed.unlock')();
    return macroWait().then(() => {
      let newBounds = this.$('.animated-container')[0].getBoundingClientRect();
      let newAfterBounds = this.$('.after')[0].getBoundingClientRect();
      assert.equalBounds(newBounds, bounds, 'bounds check during unlock');
      assert.equalBounds(newAfterBounds, afterBounds, 'after bounds check during unlock');
    });
  });
});

function bounds($elt) {
  return $elt[0].getBoundingClientRect();
}

function height($elt) {
  return bounds($elt).height;
}
