<%@page pageEncoding="UTF-8" contentType="text/html" trimDirectiveWhitespaces="true"%>
<%@include file="bundle/initialization.jspf" %>
<%@include file="bundle/router.jspf" %>

<bundle:layout page="${bundle.path}/layouts/layout.jsp">
    <bundle:variable name="head">
        <title>Kinetic Data ${text.escape(kapp.name)}</title>
    </bundle:variable>
    
    <!-- Create tabbed navigation for search results. -->
    <section class="menu">
        <ul class="nav nav-pills search">
        
            <!-- Add 'All' tab for aggregated results. Make active if no source parameter is passed in or source is search kapp. -->
            <li role="presentation" class="${text.isBlank(param['source']) || text.equals(param['source'], kapp.slug) ? "active": ""}">
                <a href="#search-all" aria-controls="search-all" role="tab" data-toggle="tab">All</a>
            </li>
            
            <!-- Add a tab for each Kapp in the space, if the Kapp is not Excluded from Global Search. Set Kapp to active if it matches the source parameter. -->
            <c:forEach var="kappIter" items="${space.kapps}">
                <c:if test="${kappIter.hasAttribute('Include in Global Search')}">
                    <li role="presentation" class="${text.equalsIgnoreCase(kappIter.slug, param['source']) ? "active": ""}">
                        <a href="#search-${kappIter.slug}" aria-controls="search-${kappIter.slug}" role="tab" data-toggle="tab">${kappIter.name}</a>
                    </li>
                </c:if>
            </c:forEach>
        </ul>
    </section>
    
    <!-- Create content for tabs. Store search term in 'data-q' attribute from passed in parameter. 
         Store page size in 'data-page-size' attribute from passed in parameter, or from kapp attribute if parameter was not passed in. -->
    <div class="tab-content search-results" data-q="${text.trim(param['q'])}" data-page-size="${text.trim(param['pageSize'], kapp.getAttributeValue("Search Page Size"))}">
    
        <!-- Create content div for 'All' tab. Set 'data-all-search' attribute to true for use in javascript to perform the correct search. -->
        <div id="search-all" role="tabpanel" class="tab-pane clearfix ${text.isBlank(param['source']) || text.equals(param['source'], kapp.slug) ? "active": ""}" data-all-search="true">
            <h3>All Search Results <c:if test="${text.isNotBlank(param['q'])}">for '${param['q']}'</c:if></h3>
            <div class="card-container">
                <div class="alert alert-info"><h5>
                    <span class="fa fa-spinner fa-spin"></span>
                    <span>Searching</span>
                </h5></div>
            </div>
        </div>
        
        <!-- Create content div for each Kapp in the space, if the Kapp is not Excluded from Global Search. 
             Set Kapp slug into 'data-kapp-slug' attribute for use in javascript to perform the correct search. -->
        <c:forEach var="kappIter" items="${space.kapps}">
            <c:if test="${kappIter.hasAttribute('Include in Global Search')}">
                <div id="search-${kappIter.slug}" role="tabpanel" class="tab-pane clearfix ${text.equalsIgnoreCase(kappIter.slug, param['source']) ? "active": ""}" data-kapp-slug="${kappIter.slug}">
                    <h3>${kappIter.name} Search Results <c:if test="${text.isNotBlank(param['q'])}">for '${param['q']}'</c:if></h3>
                    <div class="card-container">
                        <div class="alert alert-info"><h5>
                            <span class="fa fa-spinner fa-spin"></span>
                            <span>Searching</span>
                        </h5></div>
                    </div>
                </div>
            </c:if>
        </c:forEach>
    </div>
</bundle:layout>