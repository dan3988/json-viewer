<script lang="ts">

</script>
<style lang="scss">
	@use "../core.scss" as *;
	@import "../globals.scss";

    .base {
        display: flex;
        gap: 5px;
        flex-direction: column;
        width: 100%;
    }

</style>
<div class="base cr">
    <div class="group">
        <label class="check border control">
            <input class="control border check" type="checkbox"/>
            Enabled
        </label>
    </div>
    <div id="grp-limit-enabled" class="group">
        <label class="check border control">
            <input class="control border check" type="checkbox"/>
            JSON Size Limit
        </label>
    </div>
    <div id="grp-limit-value" class="group">
        <span class="lbl border">Size limit</span>
        <input class="control border hv" type="number" inputmode="numeric"/>
        <select class="control border hv">
            <option value="0">B</option>
            <option value="1">KB</option>
            <option value="2">MB</option>
            <option value="3">GB</option>
        </select>
    </div>
    <button class="btn border control lt">Save</button>
</div>