/*
 * Project: R2D2BC - Web Reader
 * Developers: Aferdita Muriqi
 * Copyright (c) 2019. DITA. All rights reserved.
 * Developed on behalf of: Bokbasen AS (https://www.bokbasen.no), CAST (http://www.cast.org)
 * Licensed to: Bokbasen AS and CAST under one or more contributor license agreements.
 * Use of this source code is governed by a BSD-style license that can be found in the LICENSE file.
 */

import LocalStorageStore from "./store/LocalStorageStore";
import IFrameNavigator, { ReaderConfig, UpLinkConfig } from "./navigator/IFrameNavigator";
import LocalAnnotator from "./store/LocalAnnotator";
import Publication from "./model/Publication";
import BookmarkModule from "./modules/BookmarkModule";
import { UserSettings } from "./model/user-settings/UserSettings";
import AnnotationModule from "./modules/AnnotationModule";
import TTSModule from "./modules/TTSModule";
import {oc} from "ts-optchain"

var R2Settings: UserSettings;
var R2Navigator: IFrameNavigator;
var BookmarkModuleInstance: BookmarkModule;
var AnnotationModuleInstance: AnnotationModule;
var TTSModuleInstance: TTSModule;

export const IS_DEV = (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev");

export async function unload() {

    if (IS_DEV) { console.log("unload reader") }
    document.body.onscroll = () => { }
    R2Navigator.stop()
    R2Settings.stop()
    BookmarkModuleInstance.stop()
    AnnotationModuleInstance.stop()
    TTSModuleInstance.stop()
}
export function startReadAloud() {
    if (IS_DEV) { console.log("startReadAloud") }
    return R2Navigator.startReadAloud()    
}
export function stopReadAloud() {
    if (IS_DEV) { console.log("stopReadAloud") }
    return R2Navigator.stopReadAloud()    
}
export function pauseReadAloud() {
    if (IS_DEV) { console.log("pauseReadAloud") }
    return R2Navigator.pauseReadAloud()    
}
export function resumeReadAloud() {
    if (IS_DEV) { console.log("resumeReadAloud") }
    return R2Navigator.resumeReadAloud()    
}


export async function saveBookmark() {
    if (IS_DEV) { console.log("saveBookmark") }
    BookmarkModuleInstance.saveBookmark()
}
export async function deleteBookmark(bookmark) {
    if (IS_DEV) { console.log("deleteBookmark") }
    BookmarkModuleInstance.deleteBookmark(bookmark)
}
export async function deleteAnnotation(highlight) {
    if (IS_DEV) { console.log("deleteAnnotation") }
    AnnotationModuleInstance.deleteAnnotation(highlight)
}
export async function addAnnotation(highlight) {
    if (IS_DEV) { console.log("addAnnotation") }
    AnnotationModuleInstance.addAnnotation(highlight)
}
export async function tableOfContents() {
    if (IS_DEV) { console.log("bookmarks") }
    return await R2Navigator.tableOfContents()    
}
export async function bookmarks() {
    if (IS_DEV) { console.log("bookmarks") }
    return await BookmarkModuleInstance.getBookmarks()    
}
export async function annotations() {
    if (IS_DEV) { console.log("annotations") }
    return await AnnotationModuleInstance.getAnnotations()    
}
export function currentResource() {
    if (IS_DEV) { console.log("currentResource") }
    return R2Navigator.currentResource()    
}
export function mostRecentNavigatedTocItem() {
    if (IS_DEV) { console.log("mostRecentNavigatedTocItem") }
    return R2Navigator.mostRecentNavigatedTocItem()    
}
export function totalResources() {
    if (IS_DEV) { console.log("totalResources") }
    return R2Navigator.totalResources()    
}
export async function resetUserSettings() {
    if (IS_DEV) { console.log("resetSettings") }
    R2Settings.resetUserSettings()
}
export async function applyUserSettings(userSettings) {
    if (IS_DEV) { console.log("applyUserSettings") }
    R2Settings.applyUserSettings(userSettings)
}
export async function increase(incremental) {
    if (IS_DEV) { console.log("increase " + incremental) }
    R2Settings.increase(incremental)
}
export async function decrease(incremental) {
    if (IS_DEV) { console.log("decrease " + incremental) }
    R2Settings.decrease(incremental)
}
export async function publisher(on) {
    if (IS_DEV) { console.log("publisher " + on) }
    R2Settings.publisher(on)
}

export async function goTo(locator) {
    if (IS_DEV) { console.log("goTo " + locator) }
    R2Navigator.goTo(locator)
}
export async function nextResource() {
    if (IS_DEV) { console.log("nextResource") }
    R2Navigator.nextResource()
}
export async function previousResource() {
    if (IS_DEV) { console.log("previousResource") }
    R2Navigator.previousResource()
}
export async function nextPage() {
    if (IS_DEV) { console.log("nextPage") }
    R2Navigator.nextPage()
}
export async function previousPage() {
    if (IS_DEV) { console.log("previousPage") }
    R2Navigator.previousPage()
}
export async function scroll(scroll) {
    if (IS_DEV) { console.log("scroll " + scroll) }
    R2Settings.scroll(scroll)
}


export async function load(config: ReaderConfig): Promise<any> {
    var mainElement = document.getElementById("D2Reader-Container");
    var headerMenu = document.getElementById("headerMenu");
    var footerMenu = document.getElementById("footerMenu");
    var webpubManifestUrl = config.url;
    var store = new LocalStorageStore({
        prefix: webpubManifestUrl.href,
        useLocalStorage: config.useLocalStorage
    });
    var settingsStore = new LocalStorageStore({
        prefix: "r2d2bc-reader",
        useLocalStorage: config.useLocalStorage
    });


    var annotator = new LocalAnnotator({ store: store });

    var upLink: UpLinkConfig
    if (config.upLinkUrl) {
        upLink = config.upLinkUrl;
    }

    const publication: Publication = await Publication.getManifest(webpubManifestUrl, store);

    R2Settings = await UserSettings.create({
        store: settingsStore,
        initialUserSettings: config.userSettings,
        headerMenu: headerMenu,
        ui: config.ui,
        api: config.api
    })

    R2Navigator = await IFrameNavigator.create({
        mainElement: mainElement,
        headerMenu: headerMenu,
        footerMenu: footerMenu,
        publication: publication,
        settings: R2Settings,
        annotator: annotator,
        upLink: upLink,
        ui: config.ui,
        initialLastReadingPosition: config.lastReadingPosition,
        material: config.material,
        api: config.api,
        injectables: config.injectables,
        selectionMenuItems: config.selectionMenuItems,
        initialAnnotationColor: config.initialAnnotationColor
    })
    // add custom modules
    // Bookmark Module
        if (oc(config.rights).enableBookmarks) {
        BookmarkModuleInstance = await BookmarkModule.create({
            annotator: annotator,
            headerMenu: headerMenu,
            rights: config.rights,
            publication: publication,
            settings: R2Settings,
            delegate: R2Navigator,
            initialAnnotations: config.initialAnnotations,
        })
    }

    // Annotation Module
    if (oc(config.rights).enableAnnotations) {
        AnnotationModuleInstance = await AnnotationModule.create({
            annotator: annotator,
            headerMenu: headerMenu,
            rights: config.rights,
            publication: publication,
            settings: R2Settings,
            delegate: R2Navigator,
            initialAnnotations: config.initialAnnotations
        })
        TTSModuleInstance = await TTSModule.create({
            annotationModule: AnnotationModuleInstance
        })
    }    

    return new Promise(resolve => resolve(R2Navigator));
}

exports.load = async function (config: ReaderConfig) {
    load(config)
}
exports.unload = async function () {
    unload()
}

exports.resetUserSettings = function () {
    resetUserSettings()
}

// - apply user setting(s)
exports.applyUserSettings = function (userSettings) {
    applyUserSettings(userSettings)
}
exports.increase = function (incremental) {
    increase(incremental)
}
exports.decrease = function (incremental) {
    decrease(incremental)
}
exports.publisher = function (on) {
    publisher(on)
}

exports.startReadAloud = function () {
    startReadAloud()
}
exports.stopReadAloud = function () {
    stopReadAloud()
}
exports.pasueReadAloud = function () {
    pauseReadAloud()
}
exports.resumeReadAloud = function () {
    resumeReadAloud()
}

// - add bookmark
// - delete bookmark
exports.saveBookmark = function () {
    saveBookmark()
}
exports.deleteBookmark = function (bookmark) {
    deleteBookmark(bookmark)
}

exports.deleteAnnotation = function (highlight) {
    deleteAnnotation(highlight)
}

exports.addAnnotation = function (highlight) {
    addAnnotation(highlight)
}

// - go to locator (this will be used for anything form toc, bookmark, last reading position etc.)
exports.goTo = function (locator) {
    goTo(locator)
}

// - next resource
// - previous resource
exports.nextResource = function () {
    nextResource()
}
exports.previousResource = function () {
    previousResource()
}

// - next page (only in paginated mode)
// - previous page (only in paginated)
exports.nextPage = function () {
    nextPage()
}
exports.previousPage = function () {
    previousPage()
}

exports.scroll = function (scroll) {
    scroll(scroll)
}

exports.tableOfContents = function () {
    return tableOfContents()
}
exports.bookmarks = function () {
    return bookmarks()
}
exports.annotations = function () {
    return annotations()
}

exports.currentResource = function() {
    return currentResource()
}
exports.mostRecentNavigatedTocItem = function() {
    return mostRecentNavigatedTocItem()
}
exports.totalResources = function() {
    return totalResources()
}
